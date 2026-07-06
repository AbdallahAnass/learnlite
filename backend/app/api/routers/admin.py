from uuid import UUID

from fastapi import APIRouter, HTTPException, status

import app.api.schemas.admin as AdminSchemas
import app.api.schemas.user as UserSchemas
import app.core.exceptions as Error
from app.api.dependencies import AdminServiceDep, active_admin

route = APIRouter(prefix="/admin", tags=["Admin"])


@route.get("/stats", response_model=AdminSchemas.PlatformStats, status_code=status.HTTP_200_OK)
async def get_platform_stats(AdminService: AdminServiceDep, _: active_admin) -> AdminSchemas.PlatformStats:
    # Getting platform stats
    return await AdminService.get_platform_stats()


@route.get("/students", response_model=list[UserSchemas.UserRead], status_code=status.HTTP_200_OK)
async def list_students(AdminService: AdminServiceDep, _: active_admin, skip: int = 0, limit: int = 50) -> list[UserSchemas.UserRead]:
    # Getting all students
    return await AdminService.list_students(skip, limit)


@route.get("/instructors", response_model=list[UserSchemas.UserRead], status_code=status.HTTP_200_OK)
async def list_instructors(AdminService: AdminServiceDep, _: active_admin, skip: int = 0, limit: int = 50) -> list[UserSchemas.UserRead]:
    # Getting all instructors
    return await AdminService.list_instructors(skip, limit)


@route.delete("/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(student_id: UUID, AdminService: AdminServiceDep, _: active_admin) -> None:
    try:
        # Deleting student
        await AdminService.delete_student(student_id)

    except Error.UserNotFoundError as e: # If student is not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)


@route.delete("/instructors/{instructor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_instructor(instructor_id: UUID, AdminService: AdminServiceDep, _: active_admin) -> None:
    try:
        # Deleting instructor
        await AdminService.delete_instructor(instructor_id)

    except Error.UserNotFoundError as e: # if instructor is not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)


@route.get("/courses", response_model=list[AdminSchemas.CourseWithInstructor], status_code=status.HTTP_200_OK)
async def list_all_courses(
    AdminService: AdminServiceDep,
    _: active_admin,
    skip: int = 0,
    limit: int = 50,
    ) -> list[AdminSchemas.CourseWithInstructor]:
    # Getting list of all courses
    return await AdminService.list_all_courses(skip, limit)


@route.put("/courses/{course_id}/unpublish", response_model=AdminSchemas.CourseWithInstructor, status_code=status.HTTP_200_OK)
async def force_unpublish_course(course_id: int, AdminService: AdminServiceDep, _: active_admin) -> AdminSchemas.CourseWithInstructor:
    try:
        # Unpublishing a course
        return await AdminService.force_unpublish_course(course_id)

    except Error.CourseNotFoundError as e: # If course not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)


@route.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course(course_id: int, AdminService: AdminServiceDep, _: active_admin) -> None:
    try:
        # Deleting course
        await AdminService.delete_course(course_id)

    except Error.CourseNotFoundError as e: # if course not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
