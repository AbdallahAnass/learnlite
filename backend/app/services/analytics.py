from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

import app.api.schemas.analytics as AnalyticsSchemas
import app.core.exceptions as Error
import app.database.models as models


class AnalyticsService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_course_analytics(self, course_id: int, instructor: models.Instructor) -> AnalyticsSchemas.CourseAnalytics:
        # Getting course from database
        course = await self.session.get(models.Course, course_id)

        # If course not found
        if not course:
            raise Error.CourseNotFoundError(course_id)

        # Verifying instructor owns the course
        if course.instructor_id != instructor.id:
            raise Error.DeniedAccessError()

        # Getting all enrollments for the course
        enrollments = (
            await self.session.execute(
                select(models.Enrollment).where(models.Enrollment.course_id == course_id)
            )
        ).scalars().all()

        # Getting total enrollments
        total_enrolled = len(enrollments)

        # Counting active enrollments
        active_enrollments = sum(1 for e in enrollments if e.status == models.Status.active)

        # Counting completed enrollments
        completed_enrollments = sum(1 for e in enrollments if e.status == models.Status.completed)

        # Getting all course progress records
        course_progresses = (
            await self.session.execute(
                select(models.Course_Progress).where(models.Course_Progress.course_id == course_id)
            )
        ).scalars().all()

        valid_progresses = [cp for cp in course_progresses if cp.total_lessons_count > 0]

        # Calculating average compilation rate
        if valid_progresses:
            avg_completion = sum(
                cp.completed_lesson_count / cp.total_lessons_count * 100
                for cp in valid_progresses
            ) / len(valid_progresses)
        else:
            avg_completion = 0.0

        # Retuning course analytic Schema
        return AnalyticsSchemas.CourseAnalytics(
            course_id=course_id,
            total_enrolled=total_enrolled,
            active_enrollments=active_enrollments,
            completed_enrollments=completed_enrollments,
            avg_completion_percentage=round(avg_completion, 2),
        )

    async def get_quiz_analytics(self, quiz_id: int, instructor: models.Instructor) -> AnalyticsSchemas.QuizAnalytics:
        # Getting quiz from database
        quiz = await self.session.get(models.Quiz, quiz_id)

        # If quiz not found
        if not quiz:
            raise Error.QuizNotFoundError(quiz_id)

        # Verifying instructor owns the course the quiz belongs to
        if quiz.lesson.module.course.instructor_id != instructor.id:  # type: ignore
            raise Error.DeniedAccessError()

        # Getting all attempts for the quiz
        attempts = (
            await self.session.execute(
                select(models.QuizAttempt).where(models.QuizAttempt.quiz_id == quiz_id)
            )
        ).scalars().all()

        # Getting number of attempts
        total_attempts = len(attempts)

        # If no attempts was taken
        if total_attempts == 0:
            return AnalyticsSchemas.QuizAnalytics(
                quiz_id=quiz_id,
                total_attempts=0,
                pass_rate=0.0,
                average_score=0.0,
            )

        # Counting the number if passed students
        passed = sum(1 for a in attempts if a.score >= 70.0)

        # Calculating the average pass rate
        pass_rate = round(passed / total_attempts * 100, 2)

        # Calculating average score rate
        average_score = round(sum(a.score for a in attempts) / total_attempts, 2)

        # Returning quiz analytics schema
        return AnalyticsSchemas.QuizAnalytics(
            quiz_id=quiz_id,
            total_attempts=total_attempts,
            pass_rate=pass_rate,
            average_score=average_score,
        )
