from uuid import UUID

from pydantic import BaseModel

from app.database.models import Status


class EnrollmentRead(BaseModel):
    id: int
    student_id: UUID
    course_id: int
    status: Status
    course_name: str
    student_name: str