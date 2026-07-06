from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.database.models import ContentType


# Base Course schema
class BaseCourse(BaseModel):
    title: str = Field(min_length=1, max_length=60)
    description: str = Field(min_length=1, max_length=250)
    skills: Optional[List[str]] | None = Field(default=None)

    @field_validator('title', 'description')
    @classmethod
    def convert_to_lowercase(cls, v: str) -> str:
        return v.lower()
    
    @field_validator("skills")
    @classmethod
    def convert_skill_to_lower(cls, skills: list):
        lowered_list = []
        for skill in skills:
            lowered_list.append(skill.lower())
        
        return lowered_list
        
# Course create schema
class CourseCreate(BaseCourse):
    pass

# Course update schema
class CourseUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=60)
    description: str | None = Field(default=None, min_length=1, max_length=250)
    skills: Optional[List[str]] | None = Field(default=None)

# Course read schema
class CourseRead(BaseCourse):
    id: int
    created_at: datetime
    instructor_id: UUID
    thumbnail_url: str | None
    published: bool

# Base Module schema
class BaseModule(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    
    @field_validator('title')
    @classmethod
    def convert_to_lowercase(cls, v: str) -> str:
        return v.lower()

# Module Read schema
class ModuleRead(BaseModule):
    id: int
    created_at: datetime
    course_id: int
    order_index: int

# Module create schema
class ModuleCreate(BaseModule):
    pass

# Update Module schema
class ModuleUpdate(BaseModel):
    title: str  | None = Field(min_length=1, max_length=255)
    
    @field_validator('title')
    @classmethod
    def convert_to_lowercase(cls, v: str) -> str:
        return v.lower()

# Base lesson schema
class BaseLesson(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content_type: ContentType

    @field_validator('title')
    @classmethod
    def convert_to_lowercase(cls, v: str) -> str:
        return v.lower()

# Lesson create schema
class LessonCreate(BaseLesson):
    pass

class LessonUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    content_type: ContentType | None = Field(default=None)

# Lesson read schema
class LessonRead(BaseLesson):
    id: int
    module_id: int
    file_url: str | None
    order_index: int
    is_indexed: bool