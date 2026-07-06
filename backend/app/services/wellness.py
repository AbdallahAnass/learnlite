from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

import app.database.models as models


class WellnessService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_progress_summary(self, student: models.Student) -> str:
        # Checking if student is not enrolled in any courses yet
        if not student.enrollments:
            return f"Student: {student.first_name} {student.last_name}\nNo enrolled courses yet."

        # String of student Name
        lines = [f"Student: {student.first_name} {student.last_name}"]

        # Getting course enrollment info of courses student enrolled in
        for enrollment in student.enrollments:
            course = enrollment.course

            # Getting course progress
            result = await self.session.execute(
                select(models.Course_Progress).where(
                    models.Course_Progress.course_id == course.id,
                    models.Course_Progress.student_id == student.id,
                )
            )
            progress = result.scalar_one_or_none()

            # Getting number of completed lessons
            completed = progress.completed_lesson_count if progress else 0

            # Getting number of total lessons in course
            total = progress.total_lessons_count if progress else 0

            # Calculating percentage
            pct = round(completed / total * 100) if total > 0 else 0

            # Adding progress info to context
            lines.append(
                f"- Course '{course.title}': {enrollment.status.value}, "
                f"{pct}% complete ({completed}/{total} lessons)"
            )

        # Last 5 quiz attempts across all courses
        result = await self.session.execute(
            select(models.QuizAttempt) # type: ignore
            .where(models.QuizAttempt.student_id == student.id)
            .order_by(models.QuizAttempt.submitted_at.desc()) # type: ignore
            .limit(5)
        )
        attempts = result.scalars().all()

        # If user have taken any quizzes
        if attempts:
            quiz_parts = []

            for attempt in attempts:
                # Getting quiz for the attempt
                quiz = await self.session.get(models.Quiz, attempt.quiz_id) # type: ignore

                if quiz:
                    # Adding the quiz title
                    quiz_parts.append(f"'{quiz.title}': {round(attempt.score)}%") # type: ignore
            
            if quiz_parts:
                # Adding the score
                lines.append("Recent quiz scores: " + ", ".join(quiz_parts))

        # Converting all the data into a single string
        return "\n".join(lines)