import shutil
from pathlib import Path
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import delete, select

import app.api.schemas.admin as AdminSchemas
import app.api.schemas.user as UserSchemas
import app.core.exceptions as Error
import app.database.models as models
from app.services.enrollment import EnrollmentService


class AdminService:
    def __init__(self, session: AsyncSession, enrollment: EnrollmentService):
        self.session = session
        self.enrollment = enrollment

    async def get_platform_stats(self) -> AdminSchemas.PlatformStats:
        # Counting students
        total_students = len((await self.session.execute(select(models.Student))).scalars().all())

        # Counting instructors
        total_instructors = len((await self.session.execute(select(models.Instructor))).scalars().all())

        # Counting courses
        total_courses = len((await self.session.execute(select(models.Course))).scalars().all())

        # Counting enrollments by status
        enrollments = (await self.session.execute(select(models.Enrollment))).scalars().all()

        # Total active
        total_active_enrollments = sum(1 for e in enrollments if e.status == models.Status.active)

        # Total active Completed
        total_completed_enrollments = sum(1 for e in enrollments if e.status == models.Status.completed)

        # Quiz attempt stats
        attempts = (await self.session.execute(select(models.QuizAttempt))).scalars().all()
        total_attempts = len(attempts)

        if total_attempts > 0:
            # Counting number of passed attempts
            passed = sum(1 for a in attempts if a.score >= 70.0)

            # Calculating quiz pass rate (proportion 0.0–1.0)
            overall_quiz_pass_rate = round(passed / total_attempts, 4)

            # Calculating quiz average score
            overall_quiz_avg_score = round(sum(a.score for a in attempts) / total_attempts, 2)
        else:
            overall_quiz_pass_rate = 0.0
            overall_quiz_avg_score = 0.0

        # Returning platform stats
        return AdminSchemas.PlatformStats(
            total_students=total_students,
            total_instructors=total_instructors,
            total_courses=total_courses,
            total_active_enrollments=total_active_enrollments,
            total_completed_enrollments=total_completed_enrollments,
            overall_quiz_pass_rate=overall_quiz_pass_rate,
            overall_quiz_avg_score=overall_quiz_avg_score,
        )

    async def list_students(self, skip: int = 0, limit: int = 50) -> list[UserSchemas.UserRead]:
        # Getting number of students
        students = (
            await self.session.execute(select(models.Student).offset(skip).limit(limit))
        ).scalars().all()

        # Returning a list of students
        return [UserSchemas.UserRead(**s.model_dump(), role=models.Roles.student) for s in students]

    async def list_instructors(self, skip: int = 0, limit: int = 50) -> list[UserSchemas.UserRead]:
        # Getting number of instructors        
        instructors = (
            await self.session.execute(select(models.Instructor).offset(skip).limit(limit))
        ).scalars().all()

        # Returning a list of instructor
        return [UserSchemas.UserRead(**i.model_dump(), role=models.Roles.instructor) for i in instructors]

    async def delete_student(self, student_id: UUID) -> None:
        # Getting student from database
        student = await self.session.get(models.Student, student_id)

        # If student not found
        if not student:
            raise Error.UserNotFoundError(student_id)

        # Deleting quiz attempts (attempt answers cascade)
        await self.session.execute(
            delete(models.QuizAttempt).where(models.QuizAttempt.student_id == student_id) # type: ignore
        )

        # Deleting lesson progress records
        await self.session.execute(
            delete(models.Lesson_Progress).where(models.Lesson_Progress.student_id == student_id) # type: ignore
        )

        # Deleting course progress records
        await self.session.execute(
            delete(models.Course_Progress).where(models.Course_Progress.student_id == student_id) # type: ignore
        )

        # Deleting enrollments
        await self.session.execute(
            delete(models.Enrollment).where(models.Enrollment.student_id == student_id) # type: ignore
        )

        # Deleting reviews
        await self.session.execute(
            delete(models.Review).where(models.Review.student_id == student_id) # type: ignore
        )

        # Deleting the student
        await self.session.delete(student)

        # Applying changes
        await self.session.commit()

    async def delete_instructor(self, instructor_id: UUID) -> None:
        # Getting instructor from database
        instructor = await self.session.get(models.Instructor, instructor_id)

        # If instructor is not found
        if not instructor:
            raise Error.UserNotFoundError(instructor_id)

        # Delete each course the instructor owns
        for course in instructor.courses:
            # unenrolling students from course
            await self.enrollment.uneroll_all_from_course(course.id)

            # Deleting course reviews
            await self.session.execute(
                delete(models.Review).where(models.Review.course_id == course.id) # type: ignore
            )

            # Deleting course from database
            await self.session.delete(course)

            # Applying changes
            await self.session.commit()

            # Deleting course directory and its file from storage
            course_dir = Path(f"storage/courses/course_{course.id}")
            if course_dir.exists():
                shutil.rmtree(course_dir)

        # Deleting the instructor
        await self.session.delete(instructor)

        # Applying changes
        await self.session.commit()

    async def list_all_courses(self, skip: int = 0, limit: int = 50) -> list[AdminSchemas.CourseWithInstructor]:
        # Getting all courses
        courses = (
            await self.session.execute(select(models.Course).offset(skip).limit(limit))
        ).scalars().all()

        # Creating a list of Course with instructor schema
        result = []
        for course in courses:
            result.append(AdminSchemas.CourseWithInstructor(
                **course.model_dump(),
                instructor_name=f"{course.instructor.first_name} {course.instructor.last_name}",
            ))

        # Returning the result
        return result

    async def force_unpublish_course(self, course_id: int) -> AdminSchemas.CourseWithInstructor:
        # Getting course from database
        course = await self.session.get(models.Course, course_id)

        # If course not found
        if not course:
            raise Error.CourseNotFoundError(course_id)

        # Removing all enrollments, progress, and quiz attempts for this course
        await self.enrollment.uneroll_all_from_course(course_id)

        # Unpublishing the course
        course.sqlmodel_update({"published": False})

        # Applying changes
        await self.session.commit()

        # Returning course details
        return AdminSchemas.CourseWithInstructor(
            **course.model_dump(),
            instructor_name=f"{course.instructor.first_name} {course.instructor.last_name}",
        )

    async def delete_course(self, course_id: int) -> None:
        # Getting course from database
        course = await self.session.get(models.Course, course_id)

        # If course not found
        if not course:
            raise Error.CourseNotFoundError(course_id)

        # Unenrolling all students
        await self.enrollment.uneroll_all_from_course(course_id)

        # Deleting the course from database
        await self.session.delete(course)

        # Applying changes
        await self.session.commit()

        # Deleting course files from storage
        course_dir = Path(f"storage/courses/course_{course_id}")
        if course_dir.exists():
            shutil.rmtree(course_dir)