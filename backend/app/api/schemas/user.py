from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.database.models import Roles


# Base User schema
class BaseUser(BaseModel):
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    email: EmailStr
    role: Roles

    @field_validator('first_name', 'last_name', 'email')
    @classmethod
    def convert_to_lowercase(cls, v: str) -> str:
        return v.lower()

# User Read class
class UserRead(BaseUser):
    id: UUID
    bio: Optional[str] = None
    avatar_url: Optional[str] = None


# User Create class
class UserCreate(BaseUser):
    password: str = Field(min_length=8, max_length=128)


# Profile update schema
class ProfileUpdate(BaseModel):
    first_name: Optional[str] = Field(default=None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(default=None, min_length=1, max_length=50)
    bio: Optional[str] = Field(default=None, max_length=500)

    @field_validator('first_name', 'last_name')
    @classmethod
    def convert_to_lowercase(cls, v: str | None) -> str | None:
        return v.lower() if v is not None else v