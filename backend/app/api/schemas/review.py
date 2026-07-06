from datetime import datetime

from pydantic import BaseModel, Field


# Schema for creating a review
class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = None


# Schema for updating a review
class ReviewUpdate(BaseModel):
    rating: int | None = Field(default=None, ge=1, le=5)
    comment: str | None = None


# Schema for reading a single review
class ReviewRead(BaseModel):
    id: int
    rating: int
    comment: str | None
    created_at: datetime
    course_id: int
    student_name: str


# Schema for a course's full review summary
class CourseReviews(BaseModel):
    average_rating: float
    total_reviews: int
    reviews: list[ReviewRead]
