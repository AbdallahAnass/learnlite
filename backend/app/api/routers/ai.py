from pathlib import Path

from fastapi import APIRouter, HTTPException, status

import app.core.exceptions as Error
from app.ai.llm import (
    generate_answer,
    generate_general_answer,
    is_course_question,
    is_relevant_to_course,
)
from app.ai.retriever import query_course
from app.ai.summarizer import generate_summary
from app.api.dependencies import EnrollmentServiceDep, SessionDep, active_student
from app.api.schemas.ai import AskRequest, AskResponse, SummaryResponse
from app.database.models import ContentType, Lesson, Status

route = APIRouter(prefix="/courses", tags=["AI"])


@route.post("/{course_id}/ask", response_model=AskResponse, status_code=status.HTTP_200_OK)
async def ask(course_id: int, body: AskRequest, student: active_student, EnrollmentService: EnrollmentServiceDep) -> AskResponse:
    try:
        # Verify student is enrolled in this course
        enrollment_status = await EnrollmentService.check_enrollment_status(course_id, student)

    except Error.CourseNotFoundError as e: # If course not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    
    # If student is not enrolled in course
    if enrollment_status == Status.unenrolled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not enrolled in this course.",
        )

    # If general conversation, skip RAG entirely
    if not is_course_question(body.question):
        # Returning question response
        return AskResponse(answer=generate_general_answer(body.question))

    # Course-related: retrieve relevant chunks from ChromaDB
    chunks = query_course(course_id, body.question)

    # If not chunks are found
    if not chunks:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No course material has been indexed yet.",
        )

    # Reject questions outside the course's subject area
    if not is_relevant_to_course(body.question, chunks):
        return AskResponse(answer="I'm here to help with questions related to this course. Please ask something about the course content!")

    # Returning the question response
    return AskResponse(answer=generate_answer(body.question, chunks))


@route.get("/lessons/{lesson_id}/summary", response_model=SummaryResponse, status_code=status.HTTP_200_OK)
async def get_lesson_summary(
    lesson_id: int,
    student: active_student,
    session: SessionDep,
    EnrollmentService: EnrollmentServiceDep,
) -> SummaryResponse:
    # Getting lesson from database
    lesson = await session.get(Lesson, lesson_id)

    # if lesson not found
    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Lesson with id: {lesson_id} not found"
        )

    # Getting course
    course = lesson.module.course
    
    # If course not published
    if not course.published:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Course with id: {course.id} not found"
        )

    try:
        # Getting student enrollment status
        enrollment_status = await EnrollmentService.check_enrollment_status(course.id, student)

    except Error.CourseNotFoundError as e: # If course not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=e.message
        )

    # If student is not enrolled
    if enrollment_status == Status.unenrolled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="You are not enrolled in this course."
        )

    # Video and pdf lessons support summarization only
    if lesson.content_type not in (ContentType.video, ContentType.pdf):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Summary is only available for video and PDF lessons.",
        )

    # If lesson does not have a file
    if not lesson.file_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No file has been uploaded for this lesson.",
        )

    if lesson.content_type == ContentType.video:
        # Get transcript generated during video processing
        transcript_path = Path(lesson.file_url).parent / "transcript.txt"

        if not transcript_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transcript not available. The video may still be processing.",
            )
        
        # Reading transcript
        content = transcript_path.read_text()

    else:
        # Get transcript generated during PDF indexing
        transcript_path = Path(lesson.file_url).parent / "transcript.txt"

        # If file does not exist
        if not transcript_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transcript not available. The PDF may not have been indexed yet.",
            )

        # Reading content
        content = transcript_path.read_text()

    # Generating summary
    summary = generate_summary(content)

    # Returning summary
    return SummaryResponse(summary=summary)
