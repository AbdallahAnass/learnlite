import asyncio
import json
import os
import shutil
import subprocess
from mimetypes import guess_type
from pathlib import Path
from uuid import UUID

from fastapi import BackgroundTasks, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import any_, or_, select

import app.api.schemas.course as CourseSchemas
import app.core.exceptions as Error
import app.database.models as models
from app.ai.embedder import delete_lesson_index
from app.ai.pipeline import ingest_lesson
from app.services.enrollment import EnrollmentService


class CourseService:
    def __init__(self, session: AsyncSession, enrollment: EnrollmentService):
        # Getting the database session
        self.session = session
        self.enrollment = enrollment
    
    async def get_course(self, course_id: int, user: dict) -> CourseSchemas.CourseRead:
        # Getting course from the database
        course = await self._get_course_by_id(course_id)

        # Check if user has authorization
        self._is_authorized(UUID(user["user_id"]), user["user_role"], course)
        
        # Returning course info
        return CourseSchemas.CourseRead(**course.model_dump())
    
    async def get_distinct_skills(self) -> list[str]:
        # Getting list of distinct skills
        result = await self.session.execute(
            select(func.unnest(models.Course.skills)).where(models.Course.published).distinct()
        )

        # Returning the list sorted
        return sorted(row[0] for row in result.fetchall())

    async def get_courses(self, skill: str | None, user: dict, skip: int = 0, limit: int = 100) -> list[CourseSchemas.CourseRead]:
        # Verifying user has access
        self._is_authorized(UUID(user["user_id"]), user["user_role"], None)

        # Getting all courses and applying offset and limit
        query = select(models.Course).where(models.Course.published).offset(skip).limit(limit)

        # Skill is provided
        if skill:
            query = query.where(skill.lower() == any_(models.Course.skills))
        
        # Executing the query
        result = await self.session.scalars(query)

        courses = result.fetchall()

        # Converting each item to CourseRead schema
        list_of_courses = []

        for course in courses:
            list_of_courses.append(CourseSchemas.CourseRead(**course.model_dump()))

        # Returning the courses
        return list_of_courses
    
    async def create_course(self, instructor: models.Instructor, course_data: CourseSchemas.CourseCreate) -> CourseSchemas.CourseRead:
        # Searching for a duplicated course title with in the same instructor
        self._check_duplicated_title(instructor.courses, course_data.title, Error.DuplicatedCourseNameError, course_data.title)

        # Checking if skills list not provided
        if course_data.skills is None:
            course_data.skills= []

        # Creating course model
        course = models.Course(
            **course_data.model_dump(),
            instructor_id=instructor.id
        )

        # Adding the course model to the database
        self.session.add(course)
        await self.session.commit()

        # Getting the new course info
        await self.session.refresh(course)

        # Creating directory for the course
        self._create_course_directory(course.id)

        # Returning course info
        return CourseSchemas.CourseRead(
            **course.model_dump()
        )
            
    async def update_course_details(
            self, 
            course_id: int, 
            course_data: CourseSchemas.CourseUpdate, 
            instructor: models.Instructor
            ) -> CourseSchemas.CourseRead:
        # Getting course from database
        course = await self._get_course_by_id(course_id)

        # Verifying instructor has permission to edit the course
        self._is_authorized(instructor.id, models.Roles.instructor, course)

        # Searching for a duplicated course title with in the same instructor
        if course_data.title:
            self._check_duplicated_title(instructor.courses, course_data.title, Error.DuplicatedCourseNameError, course_data.title)

        # Checking if skills list not provided
        if course_data.skills is None:
            course_data.skills= []
        
        # Updating the course
        course.sqlmodel_update(course_data.model_dump(exclude_none=True))

        # Adding the changes to database
        await self.session.commit()

        # Returning the course info
        return CourseSchemas.CourseRead(**course.model_dump())
            
    async def delete_course(self, course_id: int, instructor: models.Instructor) -> None:
        # Getting course from database
        course = await self._get_course_by_id(course_id)

        # Verifying instructor has permission to edit the course
        self._is_authorized(instructor.id, models.Roles.instructor, course)

        # Deleting course info from storage
        shutil.rmtree(Path(f"storage/courses/course_{course_id}"))

        # Unenrolled all students from course
        await self.enrollment.uneroll_all_from_course(course_id)

        # Deleting the course from database
        await self.session.delete(course)

        # Applying changes
        await self.session.commit()    
    
    async def get_thumbnail(self, course_id: int, user: dict) -> FileResponse:
        # Getting course from database
        course = await self._get_course_by_id(course_id)
        
        # Verifying if user has access permissions
        self._is_authorized(UUID(user["user_id"]), user["user_role"], course)
        
        # If no thumbnail is added
        if not course.thumbnail_url:
            raise FileNotFoundError()
        
        file = Path(course.thumbnail_url)
        
        # Returning the thumbnail file
        return FileResponse(
            path=file,
            filename=file.name,
            media_type=guess_type(file)[0]
        )
        
    async def save_thumbnail(self, instructor: models.Instructor, course_id: int, file: UploadFile) -> None:
        # Getting course from database
        course = await self._get_course_by_id(course_id)

        # Verifying instructor has permission to edit the course
        self._is_authorized(instructor.id, models.Roles.instructor, course)
        
        # Checking for a valid picture format (jpg, jpeg, or png),a valid content type, and file size is less than (5MB)
        MAX_SIZE = 5 * 1024 * 1024
        extension = self._validate_file(file, [".jpg", ".jpeg", ".png"], ["image/jpeg","image/jpg", "image/png"], MAX_SIZE)
        
        # Generating a new file name
        new_file_name = f"thumbnail{course_id}{extension}"

        # Saving file
        await self._save_file(Path(f"storage/courses/course_{course_id}/thumbnail") / new_file_name, file)
        
        # Saving photo url into database
        course.thumbnail_url = f"storage/courses/course_{course_id}/thumbnail/{new_file_name}"

        await self.session.commit()
    
    async def delete_thumbnail(self, course_id: int, instructor: models.Instructor) -> None:
        # Getting course from database
        course = await self._get_course_by_id(course_id)
        
        # Verifying instructor has permission to edit course
        self._is_authorized(instructor.id, models.Roles.instructor, course)
        
        # Extracting the file url
        file_url = course.thumbnail_url
        
        # Deleting the thumbnail from database
        course.sqlmodel_update({"thumbnail_url": None})

        await self.session.commit()

        # Deleting the file from storage
        if file_url:
            os.remove(Path(file_url))
        else:
            raise Error.NoFileUploadedError()

    async def get_module(self, module_id: int, user:dict) -> CourseSchemas.ModuleRead:
        # Getting module from the database
        module = await self.session.get(models.Module, module_id)

        # If module not found
        if not module:
            raise Error.ModuleNotFoundError(module_id)
        
        # Verifying if user has access permissions
        self._is_authorized(UUID(user["user_id"]), user["user_role"], module.course)
        
        # Returning the module info
        return CourseSchemas.ModuleRead(**module.model_dump())
    
    async def get_modules(self, course_id: int, user: dict) -> list[CourseSchemas.ModuleRead]:
        # Getting course by id
        course = await self._get_course_by_id(course_id)

        # Verifying if user has access permissions
        self._is_authorized(UUID(user["user_id"]), user["user_role"], course)
        
        # Converting each module to ModuleRead schema
        list_of_modules = []

        for module in course.modules:
            list_of_modules.append(CourseSchemas.ModuleRead(**module.model_dump()))
        
        # Returning the modules
        return list_of_modules


    async def add_module(
            self, 
            course_id: int, 
            module_data: CourseSchemas.ModuleCreate, 
            instructor: models.Instructor
            ) -> CourseSchemas.ModuleRead:
        # Getting course from database
        course = await self._get_course_by_id(course_id)
        
        # Verifying instructor has permission to edit course
        self._is_authorized(instructor.id, models.Roles.instructor, course)
        
        # Checking for a duplicated module title
        self._check_duplicated_title(course.modules, module_data.title, Error.DuplicatedModuleTitleError, module_data.title)

        # Calculating the new module number
        order_index = self._calculate_next_order(course.modules)
        
        # Creating a new module
        module = models.Module(
            **module_data.model_dump(),
            course_id=course_id,
            order_index=order_index
        )

        # Adding the module to the database
        self.session.add(module)
        await self.session.commit()

        # Getting the module info
        await self.session.refresh(module)

        # Creating a directory for the module
        Path(f"storage/courses/course_{course_id}/module_{module.id}").mkdir(parents=True, exist_ok=True)

        # Returning the module
        return CourseSchemas.ModuleRead(**module.model_dump())
        
    async def update_module(
            self, 
            module_id: int, 
            module_data: CourseSchemas.ModuleUpdate, 
            instructor: models.Instructor
            ) -> CourseSchemas.ModuleRead:
        # Getting th module from database
        module = await self.session.get(models.Module, module_id)

        # If module does not exist
        if not module:
            raise Error.ModuleNotFoundError(module_id)
        
        # Verifying instructor has permission to edit course
        self._is_authorized(instructor.id, models.Roles.instructor, module.course)
        
        # If title is provided
        if module_data.title:
            self._check_duplicated_title(module.course.modules, module_data.title, Error.DuplicatedModuleTitleError, module_data.title)
        
        # Adding updates
        module.sqlmodel_update(module_data.model_dump(exclude_none=True))

        # Applying changes
        await self.session.commit()

        # Returning the module info
        return CourseSchemas.ModuleRead(**module.model_dump())
            
    async def delete_module(self, module_id: int, instructor: models.Instructor) -> None:
        # Verify module exists
        module = await self.session.get(models.Module, module_id)

        # If module does not exist
        if not module:
            raise Error.ModuleNotFoundError(module_id)

        # Verifying if instructor has permission to edit course
        self._is_authorized(instructor.id, models.Roles.instructor, module.course)    

        # Storing course id
        course_id = module.course_id

        # Deleting the module from database
        await self.session.delete(module)

        # Applying changes
        await self.session.commit()

        # Deleting all module files from storage
        shutil.rmtree(Path(f"storage/courses/course_{module.course_id}/module_{module_id}"))

        # Getting course
        course = await self._get_course_by_id(course_id)

        # Refreshing to get the latest modules
        await self.session.refresh(course)

        # Fixing the order for the rest of modules
        for i in range(len(course.modules)):
            course.modules[i].sqlmodel_update({"order_index": i + 1})
            await self.session.commit()
    
    async def reorder_modules(self, course_id: int, new_order: list[int], instructor: models.Instructor) -> None:
        # Getting course from database
        course = await self._get_course_by_id(course_id)

        # Verifying instructor has permission to edit course
        self._is_authorized(instructor.id, models.Roles.instructor, course)

        # Verifying all modules order are provided, no duplicated indexes, and valid sequence
        if len(new_order) != len(course.modules) or \
            len(new_order) != len(set(new_order)) or \
            min(new_order) != 1 or max(new_order) != len(new_order):
            raise Error.InvalidOrderError()

        # Assigning each module the new order
        for i in range(len(new_order)):
            course.modules[i].sqlmodel_update({"order_index": new_order[i]})
        
        # Applying changes in database
        await self.session.commit()

    async def get_lesson(self, lesson_id: int, user: dict) -> CourseSchemas.LessonRead:
        # Getting lesson from database
        lesson = await self.session.get(models.Lesson, lesson_id)

        if not lesson: # If lesson does not exist
            raise Error.LessonNotFoundError(lesson_id)

        # Verifying if user has access
        self._is_authorized(UUID(user["user_id"]), user["user_role"], lesson.module.course)
        
        # Retuning lesson info
        return CourseSchemas.LessonRead(**lesson.model_dump(), is_indexed=self._is_lesson_indexed(lesson))
    
    async def get_lessons(self, module_id: int, user: dict) -> list[CourseSchemas.LessonRead]:
        # Getting module from the database
        module = await self.session.get(models.Module, module_id)

        if not module: # If modules does not exist
            raise Error.ModuleNotFoundError(module_id)

        # Verifying if user has access
        self._is_authorized(UUID(user["user_id"]), user["user_role"], module.course)
        
        # Converting each module to ModuleRead schema
        list_of_lessons = []

        for lesson in module.lessons:
            list_of_lessons.append(CourseSchemas.LessonRead(**lesson.model_dump(), is_indexed=self._is_lesson_indexed(lesson)))

        # Returning list of lessons        
        return list_of_lessons
    
    async def add_lesson(
            self, 
            module_id: int, 
            lesson_data: CourseSchemas.LessonCreate, 
            instructor: models.Instructor
            ) -> CourseSchemas.LessonRead:
        # Getting module from database
        module = await self.session.get(models.Module, module_id)

        # if module does not exist
        if not module:
            raise Error.ModuleNotFoundError(module_id)
        
        # Verifying the instructor has permission to edit course
        self._is_authorized(instructor.id, models.Roles.instructor, module.course)
        
        # Checking for a duplicated lesson title
        self._check_duplicated_title(module.lessons, lesson_data.title, Error.DuplicatedLessonTitleError, lesson_data.title)
        
        # Calculating the new lesson order_index
        order_index = self._calculate_next_order(module.lessons)
        
        # Creating a new lesson model
        lesson = models.Lesson(
            **lesson_data.model_dump(), 
            module_id=module.id,
            order_index=order_index
            )
        
        # Adding the lesson to the database
        self.session.add(lesson)
        await self.session.commit()

        # Getting the lesson info
        await self.session.refresh(lesson)

        # Creating a directory for the lesson
        Path(f"storage/courses/course_{module.course_id}/module_{module.id}/lesson_{lesson.id}").mkdir(parents=True, exist_ok=True)

        # Returning the lesson
        return CourseSchemas.LessonRead(**lesson.model_dump(), is_indexed=self._is_lesson_indexed(lesson))
    
    async def update_lesson(
            self, 
            lesson_id: int, 
            lesson_data: CourseSchemas.LessonUpdate, 
            instructor: models.Instructor
            ) -> CourseSchemas.LessonRead:
        
        # Getting lesson from database
        lesson = await self.session.get(models.Lesson, lesson_id)

        # If lesson does not exist
        if not lesson:
            raise Error.LessonNotFoundError(lesson_id)
        
        # Verifying instructor has permission to edit course
        self._is_authorized(instructor.id, models.Roles.instructor, lesson.module.course)

        if lesson_data.title: # If title is provided
            # Checking for a duplicated lesson title
            self._check_duplicated_title(lesson.module.lessons, lesson_data.title, Error.DuplicatedLessonTitleError, lesson_data.title)

            # updating title
            lesson.sqlmodel_update({"title": lesson_data.title})
        
        if lesson_data.content_type: # if ContentType is provided
            # If file url exist
            if lesson.file_url:
                # Deleting the lesson file
                os.remove(Path(lesson.file_url))

            # Updating the lesson file url and content type
            lesson.sqlmodel_update({"file_url": None,"content_type": lesson_data.content_type})

        # Applying changes to database
        await self.session.commit()

        # Returning the lesson info
        return CourseSchemas.LessonRead(**lesson.model_dump(), is_indexed=self._is_lesson_indexed(lesson))
    
    async def delete_lesson(self, lesson_id: int, instructor: models.Instructor) -> None:
        # Getting lesson from database
        lesson = await self.session.get(models.Lesson, lesson_id)

        if not lesson: # if lesson does not exist
            raise Error.LessonNotFoundError(lesson_id)
        
        # Verifying instructor has permission to delete lesson
        self._is_authorized(instructor.id, models.Roles.instructor, lesson.module.course)

        # Storing module id
        module_id = lesson.module_id
        
        # Deleting lesson from database
        await self.session.delete(lesson)
        await self.session.commit()

        # Deleting lesson directory
        shutil.rmtree(Path(f"storage/courses/course_{lesson.module.course_id}/module_{lesson.module_id}/lesson_{lesson_id}"))

        # Getting course
        module = await self.session.get(models.Module, module_id)

        # If course does not exist
        if not module:
            raise Error.ModuleNotFoundError(module_id)
        
        # Refreshing to get the latest modules
        await self.session.refresh(module)

        # Fixing the order for the rest of modules
        for i in range(len(module.lessons)):
            module.lessons[i].sqlmodel_update({"order_index": i + 1})
            await self.session.commit()

    async def reorder_lessons(self, module_id: int, new_order: list[int], instructor: models.Instructor) -> None:
        # Getting module from database
        module = await self.session.get(models.Module, module_id)

        # Checking if module does not exits
        if not module:
            raise Error.ModuleNotFoundError(module_id)
        
        # Verifying instructor has permission to edit course
        self._is_authorized(instructor.id, models.Roles.instructor, module.course)

        # Verifying all lesson order are provided, no duplicated indexes, and valid sequence
        if len(new_order) != len(module.lessons) or \
            len(new_order) != len(set(new_order)) or \
            min(new_order) != 1 or max(new_order) != len(new_order):
            raise Error.InvalidOrderError()

        # Assigning each module the new order
        for i in range(len(new_order)):
            module.lessons[i].sqlmodel_update({"order_index": new_order[i]})
        
        # Applying changes in database
        await self.session.commit()
    
    async def get_lesson_file(self, lesson_id, user: dict) -> FileResponse:
        # Getting lesson from database
        lesson = await self.session.get(models.Lesson, lesson_id)

        # If lesson does not exist
        if not lesson:
            raise Error.LessonNotFoundError(lesson_id)
        
        # Verifying the student has access to the course
        self._is_authorized(UUID(user["user_id"]), user["user_role"], lesson.module.course)

        # If user is a student, marking the progress of lesson as in progress
        if user["user_role"] == models.Roles.student:
            # Getting student from database
            student = await self.session.get(models.Student, UUID(user["user_id"]))

            # If student does not exist
            if not student:
                raise Error.UserNotFoundError(user["user_id"])
            
            # Checking enrollment status in course
            if await self.enrollment.check_enrollment_status(lesson.module.course_id, student) == models.Status.unenrolled:
                raise Error.EnrollmentNotFoundError()

            # Marking the lesson as in progress
            await self.enrollment.mark_as_in_progress(lesson, student)

        # Getting file
        if lesson.file_url:
            file = Path(lesson.file_url)
        else:
            raise Error.NoFileUploadedError()

        # Returning file response
        return FileResponse(
            path=file,
            filename=file.name,
            media_type=guess_type(file)[0]
        )

    async def add_lesson_file(
            self, 
            lesson_id: int, 
            instructor: models.Instructor, 
            file: UploadFile, 
            background_tasks: BackgroundTasks) -> None:
        # Getting lesson from database
        lesson = await self.session.get(models.Lesson, lesson_id)

        # If lesson does not exist
        if not lesson:
            raise Error.LessonNotFoundError(lesson_id)
        
        # Verifying instructor has permission to edit course
        self._is_authorized(instructor.id, models.Roles.instructor, lesson.module.course)
        
        # Validating file based on the content type of lesson
        if lesson.content_type == models.ContentType.video: # If file is video
            # Checking for a valid video format (mp4), a valid content type, and file size less than (500MB)
            MAX_SIZE = 500 * 1024 * 1024
            extension = self._validate_file(file, [".mp4"], ["video/mp4"], MAX_SIZE)

        elif lesson.content_type == models.ContentType.pdf: # If file is pdf
            # Checking for a valid pdf file format (pdf), a valid content type, and file size less than (20MB)
            MAX_SIZE = 20 * 1024 * 1024
            extension = self._validate_file(file, [".pdf"], ["application/pdf"], MAX_SIZE)

        elif lesson.content_type == models.ContentType.assignment: # If file is assignment (zip)
            MAX_SIZE = 50 * 1024 * 1024
            extension = self._validate_file(file, [".zip"], ["application/zip", "application/x-zip-compressed"], MAX_SIZE)

        # Generating the new file name
        new_file_name = f"{lesson.content_type.value}{lesson_id}{extension}"

        # Saving file into storage
        file_path = Path(f"storage/courses/course_{lesson.module.course_id}/module_{lesson.module_id}/lesson_{lesson.id}") / new_file_name
        await self._save_file(file_path, file)
        
        # Saving file url into database
        lesson.file_url = str(file_path)

        await self.session.commit()

        # Schedule ingestion in the background
        lesson_dir = str(file_path.parent)
        background_tasks.add_task(
            ingest_lesson,
            lesson_id,
            lesson.module.course_id,
            lesson.title,
            str(file_path),
            lesson_dir,
            lesson.content_type.value
        )

    async def delete_lesson_file(self, lesson_id: int, instructor: models.Instructor) -> None:
        # Getting lesson from database
        lesson = await self.session.get(models.Lesson, lesson_id)

        # If lesson does not exists
        if not lesson:
            raise Error.LessonNotFoundError(lesson_id)
        
        # Verifying instructor has permission to edit course
        self._is_authorized(instructor.id, models.Roles.instructor, lesson.module.course)
        
        # Storing file url
        file_url = lesson.file_url
        
        # Deleting file url from database
        lesson.sqlmodel_update({"file_url": None})
        await self.session.commit()

        # Deleting file from storage
        if file_url:
            file = Path(file_url)
            os.remove(file)

            # Remove transcript and ChromaDB chunks
            transcript = file.parent / "transcript.txt"
            if transcript.exists():
                transcript.unlink()

            # Deleting lesson index
            delete_lesson_index(lesson_id)
            
        else:
            raise Error.NoFileUploadedError()

    async def get_instructor_courses(self, instructor_id: UUID, user: dict) -> list[CourseSchemas.CourseRead]:
        # Getting instructor from database
        instructor = await self.session.get(models.Instructor, instructor_id)

        # If instructor does not exist
        if not instructor:
            raise Error.InstructorDoesNotExist(instructor_id)
        
        # Verifying if user has access
        self._is_authorized(UUID(user["user_id"]), user["user_role"], None)
        
        # Converting each course into CourseRead schema
        list_of_courses = []

        for course in instructor.courses:
            list_of_courses.append(CourseSchemas.CourseRead(**course.model_dump()))
        
        # Returning the list of courses
        return list_of_courses
    
    async def publish(self, course_id: int, instructor: models.Instructor) -> None:
        # Getting course from database
        course = await self._get_course_by_id(course_id)

        # Verifying instructor has access to edit course
        self._is_authorized(instructor.id, models.Roles.instructor, course)

        # Checking publish requirements
        issues = await self._check_publish_requirements(course)

        # If course does not meet requirements
        if issues:
            raise Error.CourseNotReadyToPublishError(issues)

        # Updating the publishing status
        course.sqlmodel_update({"published": True})

        # Applying changes
        await self.session.commit()

    async def _check_publish_requirements(self, course: models.Course) -> list[str]:
        # List to hold uncompleted requirements
        issues: list[str] = []

        # If not modules were found in course
        if not course.modules:
            issues.append("The course has no modules")

            # Returning the issue
            return issues

        # Variable to count total videos time
        total_video_seconds = 0.0

        # Looping over each module
        for module in course.modules:
            label = f'"{module.title}"'

            # Verifying that module has at least one lesson pdf or video
            has_content = any(
                l.content_type in (models.ContentType.pdf, models.ContentType.video)
                for l in module.lessons
            )

            # If module does not have at least one pdf or video lesson
            if not has_content:
                issues.append(f"Module {label} needs at least one PDF or video lesson")

            # Verifying each module have at least one quiz
            has_quiz = any(l.content_type == models.ContentType.quiz for l in module.lessons)
            if not has_quiz:
                issues.append(f"Module {label} needs at least one quiz lesson")

            # Looping over each lesson in module
            for lesson in module.lessons:
                lesson_label = f'"{lesson.title}"'

                # Verifying pdf, video, and assignment lessons have an uploaded file
                if lesson.content_type in (models.ContentType.pdf, models.ContentType.video, models.ContentType.assignment):
                    if not lesson.file_url:
                        issues.append(f"Lesson {lesson_label} in module {label} has no uploaded file")

                # Verifying quiz lessons have questions and each question has a correct answer
                if lesson.content_type == models.ContentType.quiz:
                    quiz = lesson.quiz
                    if not quiz or not quiz.questions:
                        issues.append(f"Quiz lesson {lesson_label} in module {label} has no questions")
                    else:
                        for question in quiz.questions:
                            has_correct = any(a.is_correct for a in question.answers)
                            if not has_correct:
                                issues.append(
                                    f'Question "{question.text or f"#{question.order_index}"}" '
                                    f"in quiz {lesson_label} (module {label}) has no correct answer"
                                )

                if lesson.content_type == models.ContentType.video and lesson.file_url:

                    # Adding current video time to the total video time
                    total_video_seconds += await asyncio.to_thread(
                        self._get_video_duration_seconds, lesson.file_url
                    )

        # Verifying total video time of the course is at least 3 hours
        min_seconds = 3 * 3600
        if total_video_seconds < min_seconds:
            actual_h = int(total_video_seconds // 3600)
            actual_m = int((total_video_seconds % 3600) // 60)
            issues.append(
                f"Total video duration is {actual_h}h {actual_m}m — minimum required is 3h 0m"
            )

        # Returning the issues
        return issues

    async def unpublish(self, course_id: int, instructor: models.Instructor) -> None:
        # Getting course from database
        course = await self._get_course_by_id(course_id)

        # Verifying instructor has access to edit course
        self._is_authorized(instructor.id, models.Roles.instructor, course)

        # Removing all enrollments, progress, and quiz attempts for this course
        await self.enrollment.uneroll_all_from_course(course_id)

        # Updating the publishing status
        course.sqlmodel_update({"published": False})

        # Applying changes
        await self.session.commit()

    async def search_courses(self, query: str, limit: int = 20) -> list[CourseSchemas.CourseRead]:
        # Searching title and description
        search_query = select(models.Course).where(models.Course.published).filter(
            or_(models.Course.title.ilike(f"%{query}%"), models.Course.description.ilike(f"%{query}%")) # type: ignore
            ).limit(limit)

        # Getting result
        result = await self.session.execute(search_query)

        courses = result.scalars()

        # Converting each course into a Course Schema read
        list_of_courses = []

        for course in courses:
            list_of_courses.append(CourseSchemas.CourseRead(**course.model_dump()))
        
        # Returning the courses
        return list_of_courses

    def _check_duplicated_title(self, items: list, title: str, error_class, error_arg: str) -> None:
        for item in items:
            if item.title == title:
                raise error_class(error_arg)

    def _create_course_directory(self, course_id: int) -> None:
        # Defining the base directories for a course
        base_course_structure = [
            # Parent course directory
            Path(f"storage/courses/course_{course_id}"),

            # Thumbnail directory
            Path(f"storage/courses/course_{course_id}/thumbnail")
        ]

        # Creating the directories
        for dir in base_course_structure:
            dir.mkdir(parents=True,exist_ok=True)

    async def _get_course_by_id(self, course_id) -> models.Course:
        # Getting the course from database
        course = await self.session.get(models.Course, course_id)

        # If course was not found
        if not course:
            raise Error.CourseNotFoundError(course_id)
        
        # Returning the course
        return course

    def _validate_file(self, file: UploadFile, allowed_extensions: list[str], allowed_content_type: list[str], max_size: int) -> str:
        # Checking if the file is None
        if not file.filename:
            raise Error.NoFileUploadedError()
        
        # Extracting extension extension
        extension = Path(file.filename).suffix

        # Checking for a valid extension and valid content type
        if extension not in allowed_extensions or file.content_type not in allowed_content_type:
            raise Error.InvalidFileFormatError(extension)
        
        # Checking for a valid size
        if file.size and file.size > max_size:
            raise Error.FileSizeTooLarge(max_size)
        
        # Returning the extension
        return extension
    
    async def _save_file(self, file_path: Path, file: UploadFile) -> None:
        # Reading file
        content = await file.read()

        # Writing file to disk
        with open(file_path, "wb") as f:
            f.write(content)
    
    def _is_lesson_indexed(self, lesson: models.Lesson) -> bool:
        # Excluding if no file is provided, or the lesson type has no RAG index
        if not lesson.file_url or lesson.content_type in (models.ContentType.quiz, models.ContentType.assignment):
            return False
        
        # Returning true if file exists (which means that lesson is indexed)
        return (Path(lesson.file_url).parent / "transcript.txt").exists()

    def _get_video_duration_seconds(self, file_path: str) -> float:
        try:
         # Getting the current video duration
            result = subprocess.run(
                ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", file_path],
                capture_output=True, text=True, timeout=30
            )

            # Returning video duration
            return float(json.loads(result.stdout)["format"]["duration"])
        
        except Exception: # If could not get video duration
            return 0.0

    def _calculate_next_order(self, items: list) -> int:
        # Checking if list is empty
        if len(items) == 0:
            return  1
        
        else:
            return items[-1].order_index + 1

    def _is_authorized(self, user_id: UUID, role: models.Roles, course: models.Course | None):
        # If course in not provided
        if course is None:
            return True
        
        # If user is an Administrator
        if role == models.Roles.administrator:
            return True
        
        # If user is an instructor
        elif role == models.Roles.instructor:
            # Checking if the instructor is the owner of the course
            if user_id == course.instructor_id:
                return True
        
        # Check for student TODO
        elif role == models.Roles.student:
            if course.published:
                return True
            else:
                raise Error.CourseNotFoundError(course.id)
        
        raise Error.DeniedAccessError()
