from uuid import UUID

from fastapi import APIRouter, HTTPException, status

import app.api.schemas.analytics as AnalyticsSchemas
import app.api.schemas.course as CourseSchemas
import app.core.exceptions as Error
from app.api.dependencies import (
    AnalyticsServiceDep,
    CourseServiceDep,
    active_instructor,
    any_active_user,
)

# Initializing the route
route = APIRouter(prefix="/instructor", tags=["Instructor"])


@route.get("/{instructor_id}/courses", response_model=list[CourseSchemas.CourseRead], status_code=status.HTTP_200_OK)
async def get_courses(instructor_id: UUID, CourseService: CourseServiceDep, user: any_active_user) -> list[CourseSchemas.CourseRead]:
    try:
        # Getting courses from the database
        return await CourseService.get_instructor_courses(instructor_id, user)
    
    except Error.InstructorDoesNotExist as e: # If instructor is not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.DeniedAccessError as e: # If user does not have permission to access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )


@route.get("/courses/{course_id}/analytics", response_model=AnalyticsSchemas.CourseAnalytics, status_code=status.HTTP_200_OK)
async def get_course_analytics(
    course_id: int, 
    AnalyticsService: AnalyticsServiceDep, 
    instructor: active_instructor
    ) -> AnalyticsSchemas.CourseAnalytics:
    try:
        # Getting course analysis
        return await AnalyticsService.get_course_analytics(course_id, instructor)

    except Error.CourseNotFoundError as e: # If course not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)

    except Error.DeniedAccessError as e: # If instructor is not the owner of course
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)


@route.get("/quizzes/{quiz_id}/analytics", response_model=AnalyticsSchemas.QuizAnalytics, status_code=status.HTTP_200_OK)
async def get_quiz_analytics(
    quiz_id: int, 
    AnalyticsService: AnalyticsServiceDep, 
    instructor: active_instructor
    ) -> AnalyticsSchemas.QuizAnalytics:
    try:
        # Getting quiz analysis
        return await AnalyticsService.get_quiz_analytics(quiz_id, instructor)

    except Error.QuizNotFoundError as e: # If quiz not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)

    except Error.DeniedAccessError as e: # If instructor is not the owner of course
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
