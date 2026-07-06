from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

import app.core.exceptions as Error
import app.database.models as models
from app.api.schemas.review import CourseReviews, ReviewCreate, ReviewRead, ReviewUpdate


class ReviewService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def add_review(self, course_id: int, student: models.Student, data: ReviewCreate) -> ReviewRead:
        # Getting course from database
        course = await self.session.get(models.Course, course_id)

        # If course does ont exist
        if not course:
            raise Error.CourseNotFoundError(course_id)

        # Check student is enrolled (active or completed)
        enrollment = next((e for e in student.enrollments if e.course_id == course_id), None)
        if not enrollment or enrollment.status == models.Status.unenrolled:
            raise Error.NotEnrolledError()

        # Check student hasn't already reviewed this course
        result = await self.session.execute(
            select(models.Review).where(
                models.Review.student_id == student.id,
                models.Review.course_id == course_id,
            )
        )
        if result.scalar_one_or_none():
            raise Error.ReviewAlreadyExistsError()

        # Create and save review
        review = models.Review(
            student_id=student.id,
            course_id=course_id,
            rating=data.rating,
            comment=data.comment,
        )

        # Adding review to database
        self.session.add(review)

        # Applying changes
        await self.session.commit()

        # Getting review info
        await self.session.refresh(review)

        # Returning review info
        return ReviewRead(
            **review.model_dump(),
            student_name=f"{student.first_name} {student.last_name}",
        )

    async def edit_review(self, review_id: int, student: models.Student, data: ReviewUpdate) -> ReviewRead:
        # Get review
        review = await self.session.get(models.Review, review_id)

        # If review does not exist
        if not review:
            raise Error.ReviewNotFoundError(review_id)

        # Check ownership
        if review.student_id != student.id:
            raise Error.DeniedAccessError()

        # Updating the review in database
        update_data = data.model_dump(exclude_none=True)
        if update_data:
            review.sqlmodel_update(update_data)

            # Applying changes
            await self.session.commit()

            # Getting review info
            await self.session.refresh(review)

        # Returning the review info
        return ReviewRead(
            **review.model_dump(),
            student_name=f"{student.first_name} {student.last_name}",
        )

    async def delete_review(self, review_id: int, student: models.Student) -> None:
        # Get review
        review = await self.session.get(models.Review, review_id)

        # If review does not exist
        if not review:
            raise Error.ReviewNotFoundError(review_id)

        # Check ownership
        if review.student_id != student.id:
            raise Error.DeniedAccessError()

        # Deleting review from database
        await self.session.delete(review)

        # Applying changes
        await self.session.commit()

    async def get_my_review(self, course_id: int, student: models.Student) -> ReviewRead | None:
        # Getting student review
        result = await self.session.execute(
            select(models.Review).where(
                models.Review.student_id == student.id,
                models.Review.course_id == course_id,
            )
        )
        review = result.scalar_one_or_none()

        # If no review was found
        if not review:
            return None
        
        # Returning review info
        return ReviewRead(
            **review.model_dump(),
            student_name=f"{student.first_name} {student.last_name}",
        )

    async def get_course_reviews(self, course_id: int) -> CourseReviews:
        # Check course exists
        course = await self.session.get(models.Course, course_id)

        # If course not found
        if not course:
            raise Error.CourseNotFoundError(course_id)

        # Join reviews with students in one query to get names
        result = await self.session.execute(
            select(models.Review, models.Student)
            .join(models.Student, models.Review.student_id == models.Student.id) # type: ignore
            .where(models.Review.course_id == course_id)
            .order_by(models.Review.created_at.desc())  # type: ignore
        )
        rows = result.all()

        # List of reviews
        reviews = [
            ReviewRead(
                **review.model_dump(),
                student_name=f"{student.first_name} {student.last_name}",
            )
            for review, student in rows
        ]

        # Getting total number of reviews
        total = len(reviews)

        # Calculating the average rating
        average = round(sum(r.rating for r in reviews) / total, 1) if total > 0 else 0.0

        # Returning the course review
        return CourseReviews(
            average_rating=average,
            total_reviews=total,
            reviews=reviews,
        )
