from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

# Base quiz schema
class BaseQuiz(BaseModel):
    title: str = Field(min_length=1, max_length=255)

    @field_validator("title")
    @classmethod
    def convert_to_lowercase(cls, v: str) -> str:
        return v.lower()

# Quiz Create schema
class QuizCreate(BaseQuiz):
    pass

# Quiz Update schema
class QuizUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)

    @field_validator("title")
    @classmethod
    def convert_to_lowercase(cls, v: str) -> str:
        return v.lower()

# Answer Create schema
class AnswerCreate(BaseModel):
    text: Optional[str] = Field(default=None, max_length=500)
    is_correct: bool = Field(default=False)

# Answer Update schema
class AnswerUpdate(BaseModel):
    text: Optional[str] = Field(default=None, max_length=500)
    is_correct: Optional[bool] = Field(default=None)

# Answer Read schema
class AnswerRead(BaseModel):
    id: int
    text: Optional[str]
    image_url: Optional[str]
    is_correct: bool
    question_id: int

# Answer Read for Public schema
class AnswerReadPublic(BaseModel):
    id: int
    text: Optional[str]
    image_url: Optional[str]
    question_id: int

# Question Create schema
class QuestionCreate(BaseModel):
    text: Optional[str] = Field(default=None, max_length=1000)

# Question Update schema
class QuestionUpdate(BaseModel):
    text: Optional[str] = Field(default=None, max_length=1000)

# Question Read schema
class QuestionRead(BaseModel):
    id: int
    text: Optional[str]
    image_url: Optional[str]
    order_index: int
    quiz_id: int
    answers: list[AnswerRead]

# Question Read for public schema
class QuestionReadPublic(BaseModel):
    id: int
    text: Optional[str]
    image_url: Optional[str]
    order_index: int
    quiz_id: int
    answers: list[AnswerReadPublic]

# Quiz Read schema
class QuizRead(BaseQuiz):
    id: int
    lesson_id: int
    questions: list[QuestionRead]

# Quiz Read for Public schema
class QuizReadPublic(BaseQuiz):
    id: int
    lesson_id: int
    questions: list[QuestionReadPublic]

# Submit Answer schema
class AnswerSubmit(BaseModel):
    question_id: int
    answer_id: int

# Quiz Submit schema
class QuizSubmit(BaseModel):
    answers: list[AnswerSubmit]

# Attempt answer result schema
class AttemptAnswerResult(BaseModel):
    question_id: int
    selected_answer_id: int
    is_correct: bool

# Quiz result schema
class QuizResult(BaseModel):
    quiz_id: int
    score: float
    total_questions: int
    correct_count: int
    submitted_at: datetime
    answers: list[AttemptAnswerResult]
