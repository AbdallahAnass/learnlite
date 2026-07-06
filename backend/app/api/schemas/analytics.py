from pydantic import BaseModel


class CourseAnalytics(BaseModel):
    course_id: int
    total_enrolled: int
    active_enrollments: int
    completed_enrollments: int
    avg_completion_percentage: float


class QuizAnalytics(BaseModel):
    quiz_id: int
    total_attempts: int
    pass_rate: float
    average_score: float
