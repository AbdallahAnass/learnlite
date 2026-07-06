from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class PlatformStats(BaseModel):
    total_students: int
    total_instructors: int
    total_courses: int
    total_active_enrollments: int
    total_completed_enrollments: int
    overall_quiz_pass_rate: float
    overall_quiz_avg_score: float


class CourseWithInstructor(BaseModel):
    id: int
    title: str
    description: str
    skills: list[str]
    published: bool
    created_at: datetime
    thumbnail_url: Optional[str]
    instructor_id: UUID
    instructor_name: str
