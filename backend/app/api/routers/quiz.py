from typing import Union

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

import app.api.schemas.quiz as QuizSchemas
import app.core.exceptions as Error
from app.api.dependencies import (
    QuizServiceDep,
    active_instructor,
    active_student,
    any_active_user,
)

# Initializing the route
route = APIRouter(tags=["Quizzes"])

@route.post("/lessons/{lesson_id}/quiz", response_model=QuizSchemas.QuizRead, status_code=status.HTTP_201_CREATED)
async def create_quiz(
    lesson_id: int,
    quiz_data: QuizSchemas.QuizCreate,
    QuizService: QuizServiceDep,
    instructor: active_instructor,
) -> QuizSchemas.QuizRead:
    try:
        # Creating a quiz
        return await QuizService.create_quiz(lesson_id, quiz_data, instructor)
    
    except Error.LessonNotFoundError as e: # If lesson not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
            )
    
    except Error.DeniedAccessError as e: # If instructor not the owner of the course
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
            )
    
    except Error.InvalidLessonTypeError as e: # If quiz is being added to a type other than quiz content type
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=e.message
            )
    
    except Error.QuizAlreadyExistsError as e: # If quiz already exists
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message
            )


@route.get(
    "/lessons/{lesson_id}/quiz",
    status_code=status.HTTP_200_OK,
)
async def get_quiz(lesson_id: int,
    QuizService: QuizServiceDep,
    user: any_active_user
) -> Union[QuizSchemas.QuizRead, QuizSchemas.QuizReadPublic]:
    try:
        # Getting quiz from database
        return await QuizService.get_quiz_for_lesson(lesson_id, user)
    
    except Error.LessonNotFoundError as e: # If lesson not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
            )
    
    except Error.QuizNotFoundError as e: # Quiz not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    except Error.DeniedAccessError as e: # If user does not have access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )

    except Error.CourseNotFoundError as e: # If course not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    except Error.EnrollmentNotFoundError as e: # If no enrollment is found
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )


@route.put("/quizzes/{quiz_id}", response_model=QuizSchemas.QuizRead,status_code=status.HTTP_200_OK)
async def update_quiz(
    quiz_id: int,
    quiz_data: QuizSchemas.QuizUpdate,
    QuizService: QuizServiceDep,
    instructor: active_instructor
) -> QuizSchemas.QuizRead:
    try:
        # Updating the quiz info
        return await QuizService.update_quiz(quiz_id, quiz_data, instructor)

    except Error.QuizNotFoundError as e: # If quiz not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    except Error.DeniedAccessError as e: # If instructor does not have permission
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )
        

@route.delete("/quizzes/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quiz(quiz_id: int, QuizService: QuizServiceDep, instructor: active_instructor) -> None:
    try:
        # Deleting quiz
        await QuizService.delete_quiz(quiz_id, instructor)

    except Error.QuizNotFoundError as e: # If quiz not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    except Error.DeniedAccessError as e: # If instructor does not have permission
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )


@route.post("/quizzes/{quiz_id}/questions", response_model=QuizSchemas.QuestionRead, status_code=status.HTTP_201_CREATED)
async def add_question(
    quiz_id: int,
    question_data: QuizSchemas.QuestionCreate,
    QuizService: QuizServiceDep,
    instructor: active_instructor
) -> QuizSchemas.QuestionRead:
    try:
        # Adding a question to a quiz
        return await QuizService.add_question(quiz_id, question_data, instructor)
    
    except Error.QuizNotFoundError as e: # If quiz not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    except Error.DeniedAccessError as e: # If instructor does not have permission
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )


@route.put("/questions/{question_id}", response_model=QuizSchemas.QuestionRead, status_code=status.HTTP_200_OK)
async def update_question(
    question_id: int,
    question_data: QuizSchemas.QuestionUpdate,
    QuizService: QuizServiceDep,
    instructor: active_instructor,
) -> QuizSchemas.QuestionRead:
    try:
        # Updating question
        return await QuizService.update_question(question_id, question_data, instructor)
    
    except Error.QuestionNotFoundError as e: # If quiz not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    except Error.DeniedAccessError as e: # If instructor does not have permission
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )


@route.post("/questions/{question_id}/image", response_model=QuizSchemas.QuestionRead, status_code=status.HTTP_200_OK)
async def upload_question_image(
    question_id: int,
    QuizService: QuizServiceDep,
    instructor: active_instructor,
    file: UploadFile = File(...),
) -> QuizSchemas.QuestionRead:
    try:
        # Uploading quiz image
        return await QuizService.upload_question_image(question_id, file, instructor)
    
    except Error.QuestionNotFoundError as e: # If question not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    except Error.DeniedAccessError as e: # If instructor does not have permission
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )

    except Error.NoFileUploadedError as e: # If no file is uploaded
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message
        )

    except Error.InvalidFileFormatError as e: # If file is invalid format
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=e.message
        )

    except Error.FileSizeTooLarge as e: # If file is too large
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=e.message
        )


@route.get("/questions/{question_id}/image", status_code=status.HTTP_200_OK)
async def get_question_image(question_id: int, QuizService: QuizServiceDep, user: any_active_user) -> FileResponse:
    try:
        # Getting question image
        return await QuizService.get_question_image(question_id, user)
    
    except Error.QuestionNotFoundError as e: # If question not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    except Error.DeniedAccessError as e: # If user does not have access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )

    except Error.NoFileUploadedError as e: # If no file was uploaded
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
        

@route.delete("/questions/{question_id}/image", response_model=QuizSchemas.QuestionRead, status_code=status.HTTP_200_OK)
async def delete_question_image(question_id: int, QuizService: QuizServiceDep, instructor: active_instructor) -> QuizSchemas.QuestionRead:
    try:
        # Deleting the question image
        return await QuizService.delete_question_image(question_id, instructor)
    
    except Error.QuestionNotFoundError as e: # If question not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    except Error.DeniedAccessError as e: # If instructor does not have permission
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )

    except Error.NoFileUploadedError as e: # If not file was uploaded
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    

@route.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(question_id: int, QuizService: QuizServiceDep, instructor: active_instructor,) -> None:
    try:
        # Deleting question
        await QuizService.delete_question(question_id, instructor)

    except Error.QuestionNotFoundError as e: # If question not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    except Error.DeniedAccessError as e: # If instructor does not have permission
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )


@route.post("/questions/{question_id}/answers", response_model=QuizSchemas.AnswerRead, status_code=status.HTTP_201_CREATED)
async def add_answer(
    question_id: int,
    answer_data: QuizSchemas.AnswerCreate,
    QuizService: QuizServiceDep,
    instructor: active_instructor,
) -> QuizSchemas.AnswerRead:
    try:
        # Adding answer choice to the question
        return await QuizService.add_answer(question_id, answer_data, instructor)
    
    except Error.QuestionNotFoundError as e: # If question not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    except Error.DeniedAccessError as e: # If instructor does not have permission
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )

    except Error.MaxAnswersReachedError as e: # If question reached 4 answers max
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=e.message
        )
    
    except Error.MultipleCorrectAnswersError as e: # If multiple correct answers are provided
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=e.message
        )


@route.put("/answers/{answer_id}", response_model=QuizSchemas.AnswerRead, status_code=status.HTTP_200_OK)
async def update_answer(
    answer_id: int,
    answer_data: QuizSchemas.AnswerUpdate,
    QuizService: QuizServiceDep,
    instructor: active_instructor,
) -> QuizSchemas.AnswerRead:
    try:
        # updating answer
        return await QuizService.update_answer(answer_id, answer_data, instructor)
    
    except Error.AnswerNotFoundError as e: # If answer is not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    except Error.DeniedAccessError as e: # If instructor does not have permission
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )


@route.post("/answers/{answer_id}/image", response_model=QuizSchemas.AnswerRead, status_code=status.HTTP_200_OK)
async def upload_answer_image(
    answer_id: int,
    QuizService: QuizServiceDep,
    instructor: active_instructor,
    file: UploadFile = File(...),
) -> QuizSchemas.AnswerRead:
    try:
        # Uploading answer image
        return await QuizService.upload_answer_image(answer_id, file, instructor)
    
    except Error.AnswerNotFoundError as e: # If answer is not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    except Error.DeniedAccessError as e: # If instructor does not have permission
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )

    except Error.NoFileUploadedError as e: # If no file is uploaded
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message
        )

    except Error.InvalidFileFormatError as e: # If file is invalid format
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=e.message
        )

    except Error.FileSizeTooLarge as e: # If file is too large
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=e.message
        )
    

@route.get("/answers/{answer_id}/image", status_code=status.HTTP_200_OK)
async def get_answer_image(answer_id: int, QuizService: QuizServiceDep, user: any_active_user) -> FileResponse:
    try:
        # Getting answer image
        return await QuizService.get_answer_image(answer_id, user)
    
    except Error.AnswerNotFoundError as e: # If answer is not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    except Error.DeniedAccessError as e: # If user does not have access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )

    except Error.NoFileUploadedError as e: # If no file was uploaded
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )


@route.delete("/answers/{answer_id}/image", response_model=QuizSchemas.AnswerRead, status_code=status.HTTP_200_OK)
async def delete_answer_image(answer_id: int, QuizService: QuizServiceDep, instructor: active_instructor) -> QuizSchemas.AnswerRead:
    try:
        # Deleting answer image
        return await QuizService.delete_answer_image(answer_id, instructor)
    
    except Error.AnswerNotFoundError as e: # If answer is not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=e.message
        )

    except Error.DeniedAccessError as e: # If instructor does not have permission
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail=e.message
        )

    except Error.NoFileUploadedError as e: # If file was not uploaded
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=e.message
        )


@route.delete("/answers/{answer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_answer(answer_id: int, QuizService: QuizServiceDep, instructor: active_instructor) -> None:
    try:
        # Deleting answer
        await QuizService.delete_answer(answer_id, instructor)

    except Error.AnswerNotFoundError as e: # If answer is not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    except Error.DeniedAccessError as e: # If instructor does not have permission
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )


@route.post("/quizzes/{quiz_id}/submit", response_model=QuizSchemas.QuizResult, status_code=status.HTTP_200_OK)
async def submit_quiz(
    quiz_id: int,
    submission: QuizSchemas.QuizSubmit,
    QuizService: QuizServiceDep,
    student: active_student,
) -> QuizSchemas.QuizResult:
    try:
        # Submitting quiz answers
        return await QuizService.submit_quiz(quiz_id, submission, student)
    
    except Error.QuizNotFoundError as e: # If quiz not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    except Error.EnrollmentNotFoundError as e: # If student is not enrolled in the course
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )

    except Error.InvalidQuizSubmissionError as e: # if not all quiz answers was provided
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=e.message
        )

    except Error.AnswerNotFoundError as e: # If answer is not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )


@route.get("/quizzes/{quiz_id}/result", response_model=QuizSchemas.QuizResult, status_code=status.HTTP_200_OK)
async def get_quiz_result(quiz_id: int, QuizService: QuizServiceDep, student: active_student) -> QuizSchemas.QuizResult:
    try:
        # Getting quiz score
        return await QuizService.get_quiz_result(quiz_id, student)
    
    except Error.QuizNotFoundError as e: # If quiz not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    except Error.EnrollmentNotFoundError as e: # If student is not enrolled in the course
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )

    except Error.QuizAttemptNotFoundError as e: # If no attempt was found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
