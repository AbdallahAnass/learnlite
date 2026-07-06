from fastapi import APIRouter, HTTPException, status

import app.core.exceptions as Error
from app.api.dependencies import ReviewServiceDep, active_student, any_active_user
from app.api.schemas.review import CourseReviews, ReviewCreate, ReviewRead, ReviewUpdate

# Initializing the route
route = APIRouter(tags=["Reviews"])


@route.post("/courses/{course_id}/reviews", response_model=ReviewRead, status_code=status.HTTP_201_CREATED)
async def post_review(course_id: int, body: ReviewCreate, student: active_student, ReviewService: ReviewServiceDep) -> ReviewRead:
    try:
        # Adding review
        return await ReviewService.add_review(course_id, student, body)

    except Error.CourseNotFoundError as e: # If course not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    except Error.NotEnrolledError as e: # If student is not enrolled
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )

    except Error.ReviewAlreadyExistsError as e: # If student already reviewed the course
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message
        )


@route.put("/reviews/{review_id}", response_model=ReviewRead, status_code=status.HTTP_200_OK)
async def edit_review(review_id: int, body: ReviewUpdate, student: active_student, ReviewService: ReviewServiceDep) -> ReviewRead:
    try:
        # Edit review
        return await ReviewService.edit_review(review_id, student, body)

    except Error.ReviewNotFoundError as e: # If review does not exist
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=e.message
        )

    except Error.DeniedAccessError as e: # If student is not the owner of the review
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail=e.message
        )


@route.delete("/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_review(review_id: int, student: active_student, ReviewService: ReviewServiceDep) -> None:
    try:
        # Deleting review
        await ReviewService.delete_review(review_id, student)

    except Error.ReviewNotFoundError as e: # If review does not exist
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=e.message
        )

    except Error.DeniedAccessError as e: # If user is not the owner of review
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail=e.message
        )


@route.get("/courses/{course_id}/my-review", response_model=ReviewRead | None, status_code=status.HTTP_200_OK)
async def get_my_review(course_id: int, student: active_student, ReviewService: ReviewServiceDep) -> ReviewRead | None:
    # Getting student review
    return await ReviewService.get_my_review(course_id, student)


@route.get("/courses/{course_id}/reviews", response_model=CourseReviews, status_code=status.HTTP_200_OK)
async def get_course_reviews(course_id: int, user: any_active_user, ReviewService: ReviewServiceDep) -> CourseReviews:
    try:
        # Getting course review
        return await ReviewService.get_course_reviews(course_id)

    except Error.CourseNotFoundError as e: # If course is not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=e.message
        )
