from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import delete, select

import app.core.exceptions as Error
import app.database.models as models
from app.api.schemas.course import CourseRead
from app.api.schemas.enrollment import EnrollmentRead
from app.api.schemas.user import UserRead


class EnrollmentService:
    def __init__(self, session: AsyncSession):
        # Getting the database session
        self.session = session
    
    async def enroll_student(self, course_id: int, student: models.Student) -> EnrollmentRead:
        # Getting course from database
        course = await self.session.get(models.Course, course_id)

        # If course not found
        if not course:
            raise Error.CourseNotFoundError(course_id)
        
        # If course not published
        if not course.published:
            raise Error.CourseNotPublishedError(course_id)
        
        # Verifying no duplicated enrollments
        for eCourse in student.enrolled_courses:
            if course.id == eCourse.id:
                raise Error.DuplicatedEnrollmentError()

        # Creating enrollment model
        enrollment = models.Enrollment(
            student_id=student.id,
            course_id=course.id,
            status=models.Status.active,
        )

        # Adding enrollment
        self.session.add(enrollment)

        # Applying changes
        await self.session.commit()

        # Tracking progress
        await self._initialize_progress(course, student)

        # Retuning the enrollment
        await self.session.refresh(enrollment)
        
        return EnrollmentRead(
            **enrollment.model_dump(),
            student_name= f"{student.first_name} {student.last_name}",
            course_name=course.title
            )
    
    async def get_enrollments(self, student: models.Student) -> list[EnrollmentRead]:
        # Constructing the search query
        query = select(models.Enrollment).where(models.Enrollment.student_id == student.id)

        # Getting the result
        result = await self.session.execute(query)

        enrollments = result.scalars().all()

        # Converting each enrollment to enrollment Read schema
        enrollment_reads = []

        for enrollment in enrollments:
            enrollment_reads.append(EnrollmentRead(
                **enrollment.model_dump(),
                student_name=f"{student.first_name} {student.last_name}",
                course_name=enrollment.course.title
                ))

        # Retuning the enrollments
        return enrollment_reads
    
    async def get_enrollment(self, enrollment_id: int) -> EnrollmentRead: 
        # Getting enrollment from database
        enrollment = await self.session.get(models.Enrollment, enrollment_id)

        # If enrollment does not exist
        if not enrollment:
            raise Error.EnrollmentNotFoundError()
        
        # Returning the enrollment info
        return EnrollmentRead(
            **enrollment.model_dump(),
            student_name=f"{enrollment.student.first_name} {enrollment.student.last_name}",
            course_name=enrollment.course.title
        )
    
    async def unenroll_student(self, course_id: int, student: models.Student) -> None:
        # Getting course from database
        course = await self.session.get(models.Course, course_id)

        # If course not found
        if not course:
            raise Error.CourseNotFoundError(course_id)
        
        # looping over student enrolled courses
        for enrollment in student.enrollments:
            # If course found
            if enrollment.course_id == course.id and enrollment.status != models.Status.completed:
                # Deleting enrollment
                await self.session.delete(enrollment)

                # Deleting course progress records
                await self.session.execute(delete(models.Course_Progress).where(
                    models.Course_Progress.student_id == student.id, models.Course_Progress.course_id == course.id)) # type: ignore

                # Deleting lesson progress records
                await self.session.execute(delete(models.Lesson_Progress).where(
                    models.Lesson_Progress.student_id == student.id, models.Lesson_Progress.course_id == course.id)) # type: ignore

                # Deleting quiz attempts and their answers
                quiz_ids_subq = (
                    select(models.Quiz.id)
                    .join(models.Lesson, models.Quiz.lesson_id == models.Lesson.id) # type: ignore
                    .join(models.Module, models.Lesson.module_id == models.Module.id) # type: ignore
                    .where(models.Module.course_id == course.id)
                )
                attempt_ids_subq = (
                    select(models.QuizAttempt.id)
                    .where(
                        models.QuizAttempt.student_id == student.id,
                        models.QuizAttempt.quiz_id.in_(quiz_ids_subq) # type: ignore
                    )
                )
                await self.session.execute(delete(models.AttemptAnswer).where(
                    models.AttemptAnswer.attempt_id.in_(attempt_ids_subq) # type: ignore
                ))
                await self.session.execute(delete(models.QuizAttempt).where(
                    models.QuizAttempt.student_id == student.id, # type: ignore
                    models.QuizAttempt.quiz_id.in_(quiz_ids_subq) # type: ignore
                ))

                # Applying changes
                await self.session.commit()

                return

        # If course in not found
        raise Error.EnrollmentNotFoundError()
    
    async def check_enrollment_status(self, course_id: int, student: models.Student) -> models.Status:
        # Getting course from database
        course = await self.session.get(models.Course, course_id)

        # If course not found
        if not course:
            raise Error.CourseNotFoundError(course_id)
        
        # Getting status from course
        for enrollment in student.enrollments:
            if enrollment.course_id == course.id:
                return enrollment.status
        
        # Enrollment not found
        return models.Status.unenrolled
    
    async def get_enrolled_students_in_course(self, course_id: int) -> list[UserRead]:
        # Getting course from database
        course = await self.session.get(models.Course, course_id)

        # If course not found
        if not course:
            raise Error.CourseNotFoundError(course_id)
        
        # Converting each student into student read schema
        list_of_students = []

        for student in course.enrolled_students:
            list_of_students.append(UserRead(**student.model_dump(), role=models.Roles.student))
        
        # Returning the students
        return list_of_students
        
    async def mark_quiz_as_in_progress(self, lesson_id: int, student: models.Student) -> None:
        # Getting lesson from database
        lesson = await self.session.get(models.Lesson, lesson_id)

        # If lesson is not found
        if not lesson:
            raise Error.LessonNotFoundError(lesson_id)

        # Getting the lesson progress record
        query = select(models.Lesson_Progress).where(
            models.Lesson_Progress.lesson_id == lesson.id,
            models.Lesson_Progress.student_id == student.id,
        )
        # Executing query
        result = await self.session.execute(query)
        record = result.scalar_one()

        if record.progress == models.Progress.completed:
            # Getting course progress record
            course_query = select(models.Course_Progress).where(
                models.Course_Progress.course_id == lesson.module.course_id,
                models.Course_Progress.student_id == student.id,
            )
            course_result = await self.session.execute(course_query)
            course_record = course_result.scalar_one()

            # Updating the number of completed lessons
            course_record.sqlmodel_update(
                {"completed_lesson_count": max(0, course_record.completed_lesson_count - 1)}
            )

            # Revert enrollment status to active if it was completed
            enrollment_query = select(models.Enrollment).where(
                models.Enrollment.course_id == lesson.module.course_id,
                models.Enrollment.student_id == student.id,
            )
            enrollment_result = await self.session.execute(enrollment_query)
            enrollment = enrollment_result.scalar_one_or_none()

            if enrollment and enrollment.status == models.Status.completed:
                # Setting status back to active
                enrollment.sqlmodel_update({"status": models.Status.active})

        # Updating the lesson progress record to set lesson as in progress
        record.sqlmodel_update({"progress": models.Progress.in_progress})

        # Applying changes
        await self.session.commit()

    async def mark_as_in_progress(self, lesson: models.Lesson, student: models.Student) -> None:
        # Getting lesson progress model
        query = select(models.Lesson_Progress).where(
            models.Lesson_Progress.lesson_id == lesson.id, models.Lesson_Progress.student_id == student.id
            )

        # Executing the query
        result = await self.session.execute(query)

        # Getting result
        record = result.scalar_one()

        # Updating record to be in progress
        if record.progress != models.Progress.completed:
            record.sqlmodel_update({"progress": models.Progress.in_progress})

        # Applying changes
        await self.session.commit()
    
    async def get_completed_lessons(self, course_id: int, student: models.Student) -> list[int]:
        # Getting completed lessons
        result = await self.session.execute(
            select(models.Lesson_Progress.lesson_id).where(
                models.Lesson_Progress.course_id == course_id,
                models.Lesson_Progress.student_id == student.id,
                models.Lesson_Progress.progress == models.Progress.completed,
            )
        )

        # Returning lessons
        return [row[0] for row in result.fetchall()]

    async def mark_as_completed(self, lesson_id: int, student: models.Student) -> None:
        # Getting lesson from database
        lesson = await self.session.get(models.Lesson, lesson_id)

        # If lesson not found
        if not lesson:
            raise Error.LessonNotFoundError(lesson_id)
        
        # Getting enrollment record
        query = select(models.Lesson_Progress).where(
            models.Lesson_Progress.lesson_id == lesson.id, models.Lesson_Progress.student_id == student.id
            )

        # Executing query
        result = await self.session.execute(query)

        # Getting result
        record = result.scalar_one()

        # Updating the record status
        if record.progress != models.Progress.completed:
            record.sqlmodel_update({"progress": models.Progress.completed})
        
        # Getting enrollment record
        course_red_query = select(models.Course_Progress).where(
            models.Course_Progress.course_id == lesson.module.course_id, models.Course_Progress.student_id == student.id
            )

        # Executing query
        course_result = await self.session.execute(course_red_query)

        # Getting result
        course_record = course_result.scalar_one()

        # Updating number of completed lessons
        new_count = course_record.completed_lesson_count + 1
        course_record.sqlmodel_update({"completed_lesson_count": new_count})

        # Auto-complete the enrollment when all lessons are finished
        if new_count >= course_record.total_lessons_count:
            enrollment_query = select(models.Enrollment).where(
                models.Enrollment.course_id == lesson.module.course_id,
                models.Enrollment.student_id == student.id,
            )

            enrollment_result = await self.session.execute(enrollment_query)
            enrollment = enrollment_result.scalar_one_or_none()

            if enrollment and enrollment.status == models.Status.active:
                # Setting the status of lesson to completed
                enrollment.sqlmodel_update({"status": models.Status.completed})

        # Applying changes
        await self.session.commit()
    
    async def get_student_progress(self, course_id: int, student: models.Student):
        # Getting course from database
        course = await self.session.get(models.Course, course_id)

        # If course not found
        if not course:
            raise Error.CourseNotFoundError(course_id)
        
        # Getting course progress record
        query = select(models.Course_Progress).where(
            models.Course_Progress.course_id == course.id, models.Course_Progress.student_id == student.id
            )

        # Executing query
        result = await self.session.execute(query)

        # Getting result
        course_Progress = result.scalar_one()

        # Calculating the course progress percentage
        percentage = course_Progress.completed_lesson_count / course_Progress.total_lessons_count * 100

        # Returning the progress percentage
        return round(percentage)
    
    async def get_enrolled_courses(self, student: models.Student) -> list[CourseRead]:
        # Getting student courses from database
        courses = student.enrolled_courses

        # Converting each course into a Course read schema
        list_of_courses = []

        for course in courses:
            list_of_courses.append(CourseRead(**course.model_dump()))
        
        # Returning the list of courses
        return list_of_courses
    
    async def uneroll_all_from_course(self, course_id: int) -> None:
        # Subquery for all quiz IDs belonging to this course
        quiz_ids_subq = (
            select(models.Quiz.id)
            .join(models.Lesson, models.Quiz.lesson_id == models.Lesson.id) # type: ignore
            .join(models.Module, models.Lesson.module_id == models.Module.id) # type: ignore
            .where(models.Module.course_id == course_id)
        )

        # Subquery for all attempt IDs for those quizzes
        attempt_ids_subq = (
            select(models.QuizAttempt.id)
            .where(models.QuizAttempt.quiz_id.in_(quiz_ids_subq)) # type: ignore
        )

        # Deleting quiz attempt answers
        await self.session.execute(delete(models.AttemptAnswer).where(
            models.AttemptAnswer.attempt_id.in_(attempt_ids_subq) # type: ignore
        ))

        # Deleting quiz attempts
        await self.session.execute(delete(models.QuizAttempt).where(
            models.QuizAttempt.quiz_id.in_(quiz_ids_subq) # type: ignore
        ))

        # Deleting all enrollment records for the course
        await self.session.execute(delete(models.Enrollment).where(models.Enrollment.course_id == course_id)) # type: ignore

        # Deleting all course progress records
        await self.session.execute(delete(models.Course_Progress).where(models.Course_Progress.course_id == course_id)) # type: ignore

        # Deleting all lesson progress records
        await self.session.execute(delete(models.Lesson_Progress).where(models.Lesson_Progress.course_id == course_id)) # type: ignore

        # Applying changes
        await self.session.commit()

    async def _initialize_progress(self, course: models.Course, student: models.Student) -> None:
        # Variable to hold total lesson count
        lessons_count = 0

        # Filling the lesson progress table
        for module in course.modules: # Looping over each module
            for lesson in module.lessons: # Looping over each lesson
                # Creating a lesson progress record
                lesson_progress = models.Lesson_Progress(
                    student_id=student.id,
                    lesson_id=lesson.id,
                    progress=models.Progress.not_started,
                    course_id=course.id
                )

                # Incrementing the total lessons count
                lessons_count += 1

                # Adding record to database
                self.session.add(lesson_progress)

                # Applying changes
                await self.session.commit()
        
        # Filling the course progress table
        # Creating a course progress record
        course_progress = models.Course_Progress(
            total_lessons_count=lessons_count,
            completed_lesson_count=0,
            student_id=student.id,
            course_id=course.id
        )

        # Adding record to database
        self.session.add(course_progress)

        # Applying changes
        await self.session.commit()
