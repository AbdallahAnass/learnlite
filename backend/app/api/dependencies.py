from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import oAuth2_schema
from app.database.models import Administrator, Instructor, Roles, Student
from app.database.redis import is_jti_blacklisted
from app.database.session import get_session
from app.services.admin import AdminService
from app.services.analytics import AnalyticsService
from app.services.auth import AuthService
from app.services.course import CourseService
from app.services.enrollment import EnrollmentService
from app.services.quiz import QuizService
from app.services.review import ReviewService
from app.services.user import UserService
from app.services.wellness import WellnessService

# Database session dependency annotation
# Session is automatically closed when request ends
SessionDep = Annotated[AsyncSession, Depends(get_session)]


# Authentication service dependency
def get_auth_service(session: SessionDep):
    return AuthService(session)

# Authentication service dependency annotation
AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


# Token validation dependency
async def get_access_token(token: str) -> dict:
        
    # Decoding the token
    token_data = AuthService.decode_token(token)

    # Checking if token in the blacklist
    if await is_jti_blacklisted(token_data["jti"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token revoked or invalid"
        )
    
    # Returning the user data object
    return token_data

async def get_user_access_token(token: Annotated[str, Depends(oAuth2_schema)]) -> dict:
    return await get_access_token(token)


# Role authentication dependency
async def require_role(token_data: dict, required_role: Roles,  session: SessionDep) -> Student | Instructor | Administrator:

    # Checking if the user role is the required role
    if token_data["user_role"] != required_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. {required_role.value.capitalize()} privileges required."
        )
    
    # Fetching the user from database
    user = None

    if token_data["user_role"] == Roles.student: # Searching the Student table
        user = await session.get(Student, token_data["user_id"])

    elif token_data["user_role"] == Roles.instructor: # Searching the Instructor table
        user = await session.get(Instructor, token_data["user_id"]) # type: ignore

    elif token_data["user_role"] == Roles.administrator: # Administrator the Student table
        user = await session.get(Administrator, token_data["user_id"]) # type: ignore

    # If user not found
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{required_role.value.capitalize()} not found."
        )
    
    # Returning the user
    return user


# Active Student dependency
async def require_student(token_data: Annotated[dict, Depends(get_user_access_token)], session: SessionDep):
    return await require_role(token_data, Roles.student, session)

active_student = Annotated[Student, Depends(require_student)]

# Active instructor dependency
async def require_instructor(token_data: Annotated[dict, Depends(get_user_access_token)], session: SessionDep):
    return await require_role(token_data, Roles.instructor, session)

active_instructor = Annotated[Instructor, Depends(require_instructor)]

# Active admin dependency
async def require_admin(token_data: Annotated[dict, Depends(get_user_access_token)], session: SessionDep):
    return await require_role(token_data, Roles.administrator, session)

active_admin = Annotated[Administrator, Depends(require_admin)]

# Any user dependency
any_active_user = Annotated[dict, Depends(get_user_access_token)]

# Course service dependency
def get_course_service(session: SessionDep):
    return CourseService(session, get_enrollment_service(session))

# Course service dependency annotation
CourseServiceDep = Annotated[CourseService, Depends(get_course_service)]

# Enrollment service dependency
def get_enrollment_service(session: SessionDep):
    return EnrollmentService(session)

# Enrollment service dependency annotation
EnrollmentServiceDep = Annotated[EnrollmentService, Depends(get_enrollment_service)]

# Quiz service dependency
def get_quiz_service(session: SessionDep):
    return QuizService(session, get_enrollment_service(session))

# Quiz service dependency annotation
QuizServiceDep = Annotated[QuizService, Depends(get_quiz_service)]

# Analytics service dependency
def get_analytics_service(session: SessionDep):
    return AnalyticsService(session)

# Analytics service dependency annotation
AnalyticsServiceDep = Annotated[AnalyticsService, Depends(get_analytics_service)]

# Admin service dependency
def get_admin_service(session: SessionDep):
    return AdminService(session, get_enrollment_service(session))

# Admin service dependency annotation
AdminServiceDep = Annotated[AdminService, Depends(get_admin_service)]

# User service dependency
def get_user_service(session: SessionDep):
    return UserService(session)

# User service dependency annotation
UserServiceDep = Annotated[UserService, Depends(get_user_service)]

# Wellness service dependency
def get_wellness_service(session: SessionDep):
    return WellnessService(session)

# Wellness service dependency annotation
WellnessServiceDep = Annotated[WellnessService, Depends(get_wellness_service)]

# Review service dependency
def get_review_service(session: SessionDep):
    return ReviewService(session)

# Review service dependency annotation
ReviewServiceDep = Annotated[ReviewService, Depends(get_review_service)]
