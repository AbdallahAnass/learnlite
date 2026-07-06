from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

from pydantic import EmailStr
from sqlalchemy import ARRAY, String, UniqueConstraint
from sqlalchemy.dialects import postgresql
from sqlmodel import Column, Field, Relationship, SQLModel


# Roles Enum
class Roles(str, Enum):
    student = "student"
    instructor = "instructor"
    administrator = "administrator"

# Content type Enum
class ContentType(str, Enum):
    pdf = "pdf"
    video = "video"
    quiz = "quiz"
    assignment = "assignment"

# Status type Enum
class Status(str, Enum):
    active = "active"
    completed = "completed"
    unenrolled = "unenrolled"

# Progress type Enum
class Progress(str, Enum):
    not_started = "not_started"
    in_progress = "in progress"
    completed = "completed"

# Enrollment table
class Enrollment(SQLModel, table=True):
    id: int = Field(default=None, primary_key=True)
    status: Status
    enrolled_at: datetime = Field(
          sa_column=Column(
                postgresql.TIMESTAMP,
                default=datetime.now
          )
    )

    student_id: UUID = Field(foreign_key="student.id")
    course_id: int = Field(foreign_key="course.id")

    # Student relationship
    student: "Student" = Relationship(back_populates="enrollments", sa_relationship_kwargs={"lazy": "selectin"})

    # Course relationship
    course: "Course" = Relationship(back_populates="enrollments", sa_relationship_kwargs={"lazy": "selectin"})

# User class
class User(SQLModel):
    first_name: str
    last_name: str
    email: EmailStr
    password_hash: str
    bio: Optional[str] = Field(default=None, nullable=True)
    avatar_url: Optional[str] = Field(default=None, nullable=True)

# Student Table
class Student(User, table=True):
    id: UUID = Field(
        sa_column=Column(
            postgresql.UUID,
            default=uuid4,
            primary_key=True
        )
    )

    # Enrollment relationship
    enrollments: list["Enrollment"] = Relationship(back_populates="student", sa_relationship_kwargs={"lazy": "selectin"})
    enrolled_courses: list["Course"] = Relationship(
        back_populates="enrolled_students", 
        link_model=Enrollment, 
        sa_relationship_kwargs={"lazy": "selectin"}
        )
        
# Instructor Table
class Instructor(User, table=True):
    id: UUID = Field(
        sa_column=Column(
            postgresql.UUID,
            default=uuid4,
            primary_key=True
        )
    )
        
    # Courses relation
    courses: list["Course"] = Relationship(back_populates="instructor", sa_relationship_kwargs={"lazy": "selectin"})
        
# Admin Table
class Administrator(User, table=True):
    id: UUID = Field(
        sa_column=Column(
            postgresql.UUID,
            default=uuid4,
            primary_key=True
        )
    )

# Course Table
class Course(SQLModel, table=True):
    id: int = Field(default=None, primary_key=True)
    title: str
    description: str
    created_at: datetime = Field(
          sa_column=Column(
                postgresql.TIMESTAMP,
                default=datetime.now
          )
    )
    skills: list[str] = Field(
        sa_column=Column(ARRAY(String)),
    )
    thumbnail_url: str = Field(default=None, nullable=True)
    published: bool = Field(default=False)

    instructor_id: UUID = Field(foreign_key="instructor.id")

    # Instructor relation
    instructor: "Instructor" = Relationship(back_populates="courses", sa_relationship_kwargs={"lazy": "selectin"})

    # Modules relation
    modules: list["Module"] = Relationship(
        back_populates="course", 
        sa_relationship_kwargs={"lazy": "selectin", "order_by": "Module.order_index"}, 
        cascade_delete=True
        )
    
    # Enrollment relationship
    enrollments: list["Enrollment"] = Relationship(back_populates="course", sa_relationship_kwargs={"lazy": "selectin"})
    enrolled_students: list["Student"] = Relationship(
        back_populates="enrolled_courses", 
        link_model=Enrollment, 
        sa_relationship_kwargs={"lazy": "selectin"})

# Module table
class Module(SQLModel, table=True):
    id: int = Field(default=None, primary_key=True)
    title: str = Field(nullable=False)
    order_index: int = Field(nullable=False)
    created_at: datetime = Field(
          sa_column=Column(
                postgresql.TIMESTAMP,
                default=datetime.now
          )
    )

    course_id: int = Field(foreign_key="course.id")

    # Course relation
    course: "Course" = Relationship(back_populates="modules", sa_relationship_kwargs={"lazy": "selectin"})

    # Lessons relation
    lessons: list["Lesson"] = Relationship(
        back_populates="module", 
        sa_relationship_kwargs={"lazy": "selectin", "order_by": "Lesson.order_index"}, 
        cascade_delete=True
        )

# Lesson table
class Lesson(SQLModel, table=True):
    id: int = Field(default=None, primary_key=True)
    title: str = Field(nullable=False)
    content_type: ContentType
    file_url: str = Field(default=None, nullable=True)
    order_index: int

    module_id: int = Field(foreign_key="module.id") # Set the relation

    # Module relation
    module: "Module" = Relationship(back_populates="lessons", sa_relationship_kwargs={"lazy": "selectin"})

    # Quiz relation
    quiz: Optional["Quiz"] = Relationship(back_populates="lesson", sa_relationship_kwargs={"lazy": "selectin"})

# Lesson progress table
class Lesson_Progress(SQLModel, table=True):
    id: int = Field(default=None, primary_key=True)
    progress: Progress

    student_id: UUID = Field(foreign_key="student.id")
    lesson_id: int = Field(foreign_key="lesson.id")
    course_id: int = Field(foreign_key="course.id")

# Course progress table
class Course_Progress(SQLModel, table=True):
    id: int = Field(default=None, primary_key=True)
    total_lessons_count: int
    completed_lesson_count: int

    student_id: UUID = Field(foreign_key="student.id")
    course_id: int = Field(foreign_key="course.id")


# Quiz table
class Quiz(SQLModel, table=True):
    id: int = Field(default=None, primary_key=True)
    title: str = Field(nullable=False)
    lesson_id: int = Field(foreign_key="lesson.id", unique=True)
    
    # Lesson relationship
    lesson: Optional["Lesson"] = Relationship(back_populates="quiz", sa_relationship_kwargs={"lazy": "selectin"})

    # Question relationship
    questions: list["Question"] = Relationship(
        back_populates="quiz",
        sa_relationship_kwargs={"lazy": "selectin", "order_by": "Question.order_index"},
        cascade_delete=True
    )

# Question table
class Question(SQLModel, table=True):
    id: int = Field(default=None, primary_key=True)
    text: Optional[str] = Field(default=None, nullable=True)
    image_url: Optional[str] = Field(default=None, nullable=True)
    order_index: int
    quiz_id: int = Field(foreign_key="quiz.id")

    # Quiz relationship
    quiz: Optional["Quiz"] = Relationship(back_populates="questions", sa_relationship_kwargs={"lazy": "selectin"})

    # Answer relationship
    answers: list["Answer"] = Relationship(
        back_populates="question",
        sa_relationship_kwargs={"lazy": "selectin"},
        cascade_delete=True
    )

# Answer table
class Answer(SQLModel, table=True):
    id: int = Field(default=None, primary_key=True)
    text: Optional[str] = Field(default=None, nullable=True)
    image_url: Optional[str] = Field(default=None, nullable=True)
    is_correct: bool = Field(default=False)
    question_id: int = Field(foreign_key="question.id")

    # Question relationship
    question: Optional["Question"] = Relationship(back_populates="answers", sa_relationship_kwargs={"lazy": "selectin"})

# Quiz attempt table
class QuizAttempt(SQLModel, table=True):
    id: int = Field(default=None, primary_key=True)
    score: float
    submitted_at: datetime = Field(
        sa_column=Column(postgresql.TIMESTAMP, default=datetime.now)
    )
    student_id: UUID = Field(foreign_key="student.id")
    quiz_id: int = Field(foreign_key="quiz.id")

    # Selected answer relationship
    selected_answers: list["AttemptAnswer"] = Relationship(
        back_populates="attempt",
        sa_relationship_kwargs={"lazy": "selectin"},
        cascade_delete=True
    )

# Review table
class Review(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("student_id", "course_id", name="uq_student_course_review"),)

    id: int = Field(default=None, primary_key=True)
    rating: int
    comment: Optional[str] = Field(default=None, nullable=True)
    created_at: datetime = Field(
        sa_column=Column(postgresql.TIMESTAMP, default=datetime.now)
    )

    student_id: UUID = Field(foreign_key="student.id")
    course_id: int = Field(foreign_key="course.id")

# Attempt answer table
class AttemptAnswer(SQLModel, table=True):
    id: int = Field(default=None, primary_key=True)
    attempt_id: int = Field(foreign_key="quizattempt.id")
    question_id: int = Field(foreign_key="question.id")
    selected_answer_id: int = Field(foreign_key="answer.id")

    # Attempt relationship
    attempt: Optional["QuizAttempt"] = Relationship(back_populates="selected_answers", sa_relationship_kwargs={"lazy": "selectin"})
