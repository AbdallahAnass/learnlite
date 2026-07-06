from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile, status
from fastapi.responses import Response

import app.api.schemas.course as CourseSchemas
import app.core.exceptions as Error
from app.api.dependencies import CourseServiceDep, active_instructor, any_active_user

# Initializing the route
route = APIRouter(prefix="/courses", tags=["Courses"])


@route.get("/skills", response_model=list[str], status_code=status.HTTP_200_OK)
async def list_skills(CourseService: CourseServiceDep, user: any_active_user) -> list[str]:
    # Getting courses skills
    return await CourseService.get_distinct_skills()

@route.get("/{course_id}", response_model=CourseSchemas.CourseRead, status_code=status.HTTP_200_OK)
async def get_course_info(course_id: int, CourseService: CourseServiceDep, user: any_active_user) -> CourseSchemas.CourseRead:
    try:
        # Getting course info
        return await CourseService.get_course(course_id, user)

    except Error.CourseNotFoundError as e: # If course not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    except Error.DeniedAccessError as e: # If user does not have permission to access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )

@route.get("/", response_model=list[CourseSchemas.CourseRead], status_code=status.HTTP_200_OK)
async def list_courses(
    CourseService: CourseServiceDep,
    user: any_active_user,
    skill: str | None = None,
    skip: int = 0,
    limit: int = 20) -> list[CourseSchemas.CourseRead]:
    # Getting the courses with the provided skill
    return await CourseService.get_courses(skill, user, skip, limit)

@route.post("/", response_model=CourseSchemas.CourseRead, status_code=status.HTTP_201_CREATED)
async def add_course(
    course_data: CourseSchemas.CourseCreate,
    CourseService: CourseServiceDep, 
    instructor: active_instructor
    ) -> CourseSchemas.CourseRead:        
    # Adding new course 
    try:
        return await CourseService.create_course(instructor, course_data)

    except Error.DuplicatedCourseNameError as e: # If title is duplicated for the instructor
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message
        )

@route.put("/{course_id}", response_model=CourseSchemas.CourseRead, status_code=status.HTTP_200_OK)
async def update_course(
    course_id: int, 
    course_data: CourseSchemas.CourseUpdate, 
    CourseService: CourseServiceDep, 
    instructor: active_instructor
    ) -> CourseSchemas.CourseRead:
    try: 
        # Updating the course details
        return await CourseService.update_course_details(course_id, course_data, instructor)
    
    except Error.CourseNotFoundError as e: # If invalid course id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.DeniedAccessError as e: # If user does not have permission to access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )

    except Error.DuplicatedCourseNameError as e: # If title is duplicated for the instructor
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message
        )

@route.delete("/{course_id}", response_model=dict[str, str], status_code=status.HTTP_200_OK)
async def remove_course(course_id: int, CourseService: CourseServiceDep, instructor: active_instructor) -> dict[str, str]:
    try:
        # Deleting the course
        await CourseService.delete_course(course_id, instructor)
    
    except Error.CourseNotFoundError as e: # If invalid course id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.DeniedAccessError as e: # If user does not have permission to access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )
    
    except FileNotFoundError: # If directory of the course is not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course directory not found"
        )
    
    # Returning a success message
    return {
        "message": f"course with id: {course_id} has been deleted successfully"
        }

@route.get("/{course_id}/thumbnail", status_code=status.HTTP_200_OK)
async def get_thumbnail(course_id: int, CourseService: CourseServiceDep, user: any_active_user) -> Response:
    try: 
        # Getting the file thumbnail
        return await CourseService.get_thumbnail(course_id, user)
    
    except FileNotFoundError: # If thumbnail not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No thumbnail is provided"
        )
    
    except Error.DeniedAccessError as e: # If user does not have permission to access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )

@route.post("/{course_id}/thumbnail", response_model=dict[str, str], status_code=status.HTTP_200_OK)
async def upload_thumbnail(
    course_id: int,
    CourseService: CourseServiceDep,
    instructor: active_instructor,
    file: UploadFile= File(...)
    ) -> dict[str, str]:
    try:
        # Adding thumbnail file to storage
        await CourseService.save_thumbnail(instructor, course_id, file)

    except Error.DeniedAccessError as e: # If user does not have permission to access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )
    
    except Error.CourseNotFoundError as e: # If invalid course id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.NoFileUploadedError as e: # If user didn't upload a file
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message
        )
    
    except Error.InvalidFileFormatError as e: # If file format is not supported
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=e.message
        )
    
    except Error.FileSizeTooLarge as e: #If file size is large
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=e.message
        )
    
    # Returning success message
    return {
        "message": "Thumbnail added successfully"
    }

@route.delete("/{course_id}/thumbnail", response_model=dict[str, str], status_code=status.HTTP_200_OK)
async def remove_thumbnail(course_id: int, CourseService: CourseServiceDep, instructor: active_instructor) -> dict[str, str]:
    try:
        await CourseService.delete_thumbnail(course_id, instructor)
    
    except Error.CourseNotFoundError as e: # If course not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.NoFileUploadedError as e: # If no thumbnail is provided
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    # Returning a success message
    return {
        "message": "Thumbnail has been deleted successfully"
    }

@route.get("/{course_id}/modules", response_model=list[CourseSchemas.ModuleRead], status_code=status.HTTP_200_OK)
async def list_modules(course_id: int, CourseService: CourseServiceDep, user: any_active_user) -> list[CourseSchemas.ModuleRead]:
    try: 
        # Getting the modules from database
        return await CourseService.get_modules(course_id, user)
    
    except Error.CourseNotFoundError as e: # If course not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.DeniedAccessError as e: # If user does not have permission to access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )

@route.get("/modules/{module_id}", response_model=CourseSchemas.ModuleRead, status_code=status.HTTP_200_OK)
async def get_module_info(module_id: int, CourseService: CourseServiceDep, user: any_active_user):
    try:
        # Getting module info from database
        return await CourseService.get_module(module_id, user)
    
    except Error.ModuleNotFoundError as e: # If module is not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.DeniedAccessError as e: # If user does not have permission to access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )

@route.post("/{course_id}/modules", response_model=CourseSchemas.ModuleRead, status_code=status.HTTP_201_CREATED)
async def create_module(
    course_id: int, 
    module_data: CourseSchemas.ModuleCreate, 
    CourseService: CourseServiceDep, 
    instructor: active_instructor
    ) -> CourseSchemas.ModuleRead:
    try:
        # Adding a new module to the course
        module = await CourseService.add_module(course_id, module_data, instructor)
    
    except Error.CourseNotFoundError as e: # If invalid course id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.DeniedAccessError as e: # If user does not have permission to access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )
    
    except Error.DuplicatedModuleTitleError as e: # If title of the module is duplicated in the course
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message
        )
        
    # Returning module info
    return module

@route.put("/modules/{module_id}", response_model=CourseSchemas.ModuleRead, status_code=status.HTTP_200_OK)
async def update_module_info(
    module_id: int, 
    module_data: CourseSchemas.ModuleUpdate, 
    CourseService: CourseServiceDep, 
    instructor: active_instructor
    ) -> CourseSchemas.ModuleRead:

    try:
        # updating the module in database
        return await CourseService.update_module(module_id, module_data, instructor)
    
    except Error.ModuleNotFoundError as e: # If module does not exist
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.CourseNotFoundError as e: # If invalid course id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.DeniedAccessError as e: # If user does not have permission to access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )
    
    except Error.DuplicatedModuleTitleError as e: # If title of the module is duplicated in the course
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message
        )
    
@route.delete("/modules/{module_id}", response_model=dict[str, str], status_code=200)
async def remove_module(module_id: int, CourseService: CourseServiceDep, instructor: active_instructor):
    try:
        await CourseService.delete_module(module_id, instructor)
    
    except Error.ModuleNotFoundError as e: # If invalid module id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.CourseNotFoundError as e: # If invalid course id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.DeniedAccessError as e: # If user does not have permission to access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )
    
    except FileNotFoundError: # If directory of the module is not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course directory not found"
        )
    
    # Returning a success message
    return {
        "message": f"Module with id: {module_id} has been deleted successfully"
    }
    
@route.put("/{course_id}/modules/reorder", response_model=dict[str, str], status_code=status.HTTP_200_OK)
async def change_modules_order(
    course_id: int, 
    module_order: list[int], 
    instructor: active_instructor, 
    CourseService: CourseServiceDep
    ) -> dict[str, str]:
    try:
        # Applying new order of modules
        await CourseService.reorder_modules(course_id, module_order, instructor)

    except Error.CourseNotFoundError as e: # If invalid course id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.DeniedAccessError as e: # If user does not have permission to access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )
    
    except Error.InvalidOrderError as e: # If order provided is not valid
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message
        )
    
    # Returning success message
    return {
        "message": "New order has been applied"
    }

@route.get("/modules/{module_id}/lessons", response_model=list[CourseSchemas.LessonRead])
async def get_module_lessons(module_id: int, CourseService: CourseServiceDep, user: any_active_user) -> list[CourseSchemas.LessonRead]:
    try:
        # Getting the list of lessons
        return await CourseService.get_lessons(module_id, user)
    
    except Error.ModuleNotFoundError as e: # If module is not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.DeniedAccessError as e: # If user does not have permission to access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )

@route.get("/lessons/{lesson_id}", response_model=CourseSchemas.LessonRead, status_code=status.HTTP_200_OK)
async def get_lesson_info(lesson_id: int, CourseService: CourseServiceDep, user: any_active_user) -> CourseSchemas.LessonRead:
    try:
        # Getting lesson info
        return await CourseService.get_lesson(lesson_id, user)
    
    except Error.LessonNotFoundError as e: # If lesson is not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.DeniedAccessError as e: # If user does not have permission to access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )

@route.post("/modules/{module_id}/lessons", response_model=CourseSchemas.LessonRead, status_code=status.HTTP_201_CREATED)
async def create_lesson(
    module_id: int, 
    lesson_data: CourseSchemas.LessonCreate, 
    CourseService: CourseServiceDep, 
    instructor: active_instructor
    ) -> CourseSchemas.LessonRead:
    try:
        # Adding the lesson to the module
        return await CourseService.add_lesson(module_id, lesson_data, instructor)
    
    except Error.CourseNotFoundError as e: # If invalid course id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.DeniedAccessError as e: # If user does not have permission to access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        ) 
    
    except Error.ModuleNotFoundError as e: # If invalid module id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.DuplicatedLessonTitleError as e: # If title of the lesson is duplicated
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message
        )

@route.put("/lessons/{lesson_id}")
async def update_lesson_info(
    lesson_id: int, 
    lesson_data: CourseSchemas.LessonUpdate, 
    CourseService: CourseServiceDep, 
    instructor: active_instructor
    ) -> CourseSchemas.LessonRead:
    try:
        # Updating lesson
        return await CourseService.update_lesson(lesson_id, lesson_data, instructor)

    except Error.CourseNotFoundError as e: # If invalid course id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.DeniedAccessError as e: # If user does not have permission to access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )
    
    except Error.ModuleNotFoundError as e: # If invalid module id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.LessonNotFoundError as e: # If lesson is not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
        
    except Error.DuplicatedLessonTitleError as e: # If title of the lesson is duplicated
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message
        )

@route.put("/modules/{module_id}/reorder", response_model=dict[str, str], status_code=status.HTTP_200_OK)
async def change_lessons_order(
    module_id: int, 
    lesson_order: list[int], 
    instructor: active_instructor, 
    CourseService: CourseServiceDep
    ) -> dict[str, str]:
    try:
        # Applying new order of modules
        await CourseService.reorder_lessons(module_id, lesson_order, instructor)
    
    except Error.ModuleNotFoundError as e: # If invalid module id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    except Error.CourseNotFoundError as e: # If invalid course id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.DeniedAccessError as e: # If user does not have permission to access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )
    
    except Error.InvalidOrderError as e: # If order provided is not valid
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message
        )
    
    # Returning success message
    return {
        "message": "New order has been applied"
    }

@route.get("/lessons/{lesson_id}/file", status_code=status.HTTP_200_OK)
async def get_file(lesson_id: int, CourseService: CourseServiceDep, user: any_active_user) -> Response:
    try:
        # Getting lesson file
        return await CourseService.get_lesson_file(lesson_id, user)
    
    except Error.LessonNotFoundError as e: # If lesson is not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.DeniedAccessError as e: # If user does not have permission to access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )
    
    except Error.NoFileUploadedError as e: # If not file is uploaded in lesson
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.UserNotFoundError as e: # If user is not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

@route.delete("/lessons/{lesson_id}/file", response_model=dict[str, str], status_code=status.HTTP_200_OK)
async def delete_file(lesson_id: int, CourseService: CourseServiceDep, instructor: active_instructor) -> dict[str, str]:
    try:
        # deleting file lesson
        await CourseService.delete_lesson_file(lesson_id, instructor)
    
    except Error.LessonNotFoundError as e: # If lesson is not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.DeniedAccessError as e: # If user does not have permission to access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )
    
    except Error.NoFileUploadedError as e: # If no file is uploaded in lesson
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    # Returning a success message
    return {
        "message": f"Lesson file with id: {lesson_id} has been deleted successfully"
    }

@route.put("/lessons/{lesson_id}/upload", response_model=dict[str, str], status_code=status.HTTP_200_OK)
async def upload_lesson(
    lesson_id: int,
    CourseService: CourseServiceDep,
    instructor: active_instructor,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
) -> dict[str, str]:
    try:
        # Adding file to the lesson
        await CourseService.add_lesson_file(lesson_id, instructor, file, background_tasks)
    
    except Error.CourseNotFoundError as e: # If invalid course id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.DeniedAccessError as e: # If user does not have permission to access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )
    
    except Error.ModuleNotFoundError as e: # If invalid module id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.LessonNotFoundError as e: # If lesson is not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.NoFileUploadedError as e: # If user didn't upload a file
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message
        )
    
    except Error.InvalidFileFormatError as e: # If file format is not supported
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=e.message
        )
    
    except Error.FileSizeTooLarge as e: #If file size is large
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=e.message
        )
    
    # Returning success message
    return {
        "message": "File added successfully"
    }

@route.delete("/lessons/{lesson_id}", response_model=dict[str, str], status_code=status.HTTP_200_OK)
async def remove_lesson(lesson_id: int, instructor: active_instructor, CourseService: CourseServiceDep) -> dict[str, str]:
    try:
        # Deleting lesson
        await CourseService.delete_lesson(lesson_id, instructor)
    
    except Error.LessonNotFoundError as e: # If lesson is not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.CourseNotFoundError as e: # If invalid course id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    
    except Error.DeniedAccessError as e: # If user does not have permission to access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )
    
    # Retuning success message
    return {
        "message": f"Lesson with id: {lesson_id} has been deleted successfully"
    }

@route.put("/{course_id}/publish", response_model=dict[str, str], status_code=status.HTTP_200_OK)
async def publish_course(course_id: int, instructor: active_instructor, CourseService: CourseServiceDep) -> dict[str, str]:
    try:
        # Publishing course
        await CourseService.publish(course_id, instructor)

    except Error.CourseNotFoundError as e: # If invalid course id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    except Error.DeniedAccessError as e: # If user does not have permission to access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )

    except Error.CourseNotReadyToPublishError as e: # If course does not meet publish requirements
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=e.message
        )

    return {
        "message": f"Course with id: {course_id} is now published"
    }

@route.put("/{course_id}/unpublish", response_model=dict[str, str], status_code=status.HTTP_200_OK)
async def unpublish_course(course_id: int, instructor: active_instructor, CourseService: CourseServiceDep) -> dict[str, str]:
    try:
        # Publishing course
        await CourseService.unpublish(course_id, instructor)
    
    except Error.CourseNotFoundError as e: # If invalid course id
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    except Error.DeniedAccessError as e: # If user does not have permission to access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )
    
    return {
        "message": f"Course with id: {course_id} is now unpublished"
    }

@route.get("/search/{query}", response_model=list[CourseSchemas.CourseRead], status_code=status.HTTP_200_OK)
async def search(query: str, CourseService: CourseServiceDep, limit: int = 20) -> list[CourseSchemas.CourseRead]:
    # Searching courses
    return await CourseService.search_courses(query, limit)