from fastapi import APIRouter, HTTPException, status

import app.core.exceptions as Error
from app.api.dependencies import EnrollmentServiceDep, active_instructor, active_student
from app.api.schemas.course import CourseRead
from app.api.schemas.enrollment import EnrollmentRead
from app.api.schemas.user import UserRead
from app.database.models import Status

# Initializing the route
route = APIRouter(prefix="/enrollment", tags=["Enrollment"])

@route.post("/", response_model=EnrollmentRead, status_code=status.HTTP_200_OK)
async def add_enrollment(course_id: int, student: active_student, EnrollmentService: EnrollmentServiceDep) -> EnrollmentRead:
    try:
        # Enrolling student in course
        return await EnrollmentService.enroll_student(course_id, student)
    
    except Error.CourseNotFoundError as e: # If course not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.DuplicatedEnrollmentError as e: # If there is a duplicated enrollment
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message
        )
    
    except Error.CourseNotPublishedError as e: # If course is not published
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message
        )

@route.get("/", response_model=list[EnrollmentRead], status_code=status.HTTP_200_OK)
async def list_enrollments(student: active_student, EnrollmentService: EnrollmentServiceDep) -> list[EnrollmentRead]:
    # Getting enrollments
    return await EnrollmentService.get_enrollments(student)

@route.get("/enrolled-courses", response_model=list[CourseRead], status_code=status.HTTP_200_OK) 
async def get_student_courses(EnrollmentService: EnrollmentServiceDep, student: active_student) -> list[CourseRead]:
    # Getting list of student enrolled courses
    return await EnrollmentService.get_enrolled_courses(student)

@route.get("/completed-lessons/{course_id}", response_model=list[int], status_code=status.HTTP_200_OK)
async def get_completed_lessons(course_id: int, student: active_student, EnrollmentService: EnrollmentServiceDep) -> list[int]:
    # Getting list of completed lessons
    return await EnrollmentService.get_completed_lessons(course_id, student)

@route.get("/{enrollment_id}", response_model=EnrollmentRead, status_code=status.HTTP_200_OK)
async def get_enrollment_details(enrollment_id: int, EnrollmentService: EnrollmentServiceDep) -> EnrollmentRead:
    try:
        # Getting enrollment details
        return await EnrollmentService.get_enrollment(enrollment_id)
    
    except Error.EnrollmentNotFoundError as e: # If course not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

@route.delete("/{course_id}", response_model=dict[str, str], status_code=status.HTTP_200_OK)
async def remove_enrollment(course_id: int, student: active_student, EnrollmentService: EnrollmentServiceDep) -> dict[str, str]:
    try:
        # Removing enrollment
        await EnrollmentService.unenroll_student(course_id, student)
    
    except Error.EnrollmentNotFoundError as e: # If course not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.CourseNotFoundError as e: # If course not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    # Returning success message
    return {
        "message": "Successfully unenrolled from course"
    }

@route.get("/enrollment-status/{course_id}", response_model=Status, status_code=status.HTTP_200_OK)
async def get_enrollment_status(course_id: int, student: active_student, EnrollmentService: EnrollmentServiceDep) -> Status:
    try:
        # Getting enrollment status
        return await EnrollmentService.check_enrollment_status(course_id, student)
    
    except Error.CourseNotFoundError as e: # If course not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

@route.get("/courses/{course_id}", response_model=list[UserRead], status_code=status.HTTP_200_OK)
async def get_enrolled_students(course_id: int, instructor: active_instructor, EnrollmentService: EnrollmentServiceDep) -> list[UserRead]:
    try: 
        # Getting enrolled students in course
        return await EnrollmentService.get_enrolled_students_in_course(course_id)
    
    except Error.CourseNotFoundError as e: # If course not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

@route.post("/progress/{lesson_id}", response_model=dict[str, str])
async def mark_completed(lesson_id: int, student: active_student, EnrollmentService: EnrollmentServiceDep) ->dict[str, str]:
    try:
        # Marking lesson as completed
        await EnrollmentService.mark_as_completed(lesson_id, student)
    
    except Error.LessonNotFoundError as e: # If lesson not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    # Returning success message
    return {
        "message": f"lesson with id: {lesson_id} has been marked completed"
    }

@route.get("/progress/{course_id}")
async def get_progress(course_id: int, EnrollmentService: EnrollmentServiceDep, student: active_student):
    try:
        # Getting student progress
        return await EnrollmentService.get_student_progress(course_id, student)
    
    except Error.CourseNotFoundError as e: # if course not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=e.message
        )