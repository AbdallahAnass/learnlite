from fastapi import APIRouter, status

from app.ai.wellness_bot import generate_advice, generate_chat_response
from app.api.dependencies import WellnessServiceDep, active_student
from app.api.schemas.wellness import AdviceResponse, ChatRequest, ChatResponse

# Initializing route
route = APIRouter(prefix="/wellness", tags=["Wellness"])


@route.get("/advice", response_model=AdviceResponse, status_code=status.HTTP_200_OK)
async def get_login_advice(student: active_student, WellnessService: WellnessServiceDep) -> AdviceResponse:
    # Getting summary of student progress
    progress_summary = await WellnessService.get_progress_summary(student)

    # Generating advice
    advice = generate_advice(progress_summary)

    # Returning the advice to student
    return AdviceResponse(advice=advice)


@route.post("/chat", response_model=ChatResponse, status_code=status.HTTP_200_OK)
async def chat(body: ChatRequest, student: active_student, WellnessService: WellnessServiceDep) -> ChatResponse:
    # Getting summary of student progress
    progress_summary = await WellnessService.get_progress_summary(student)

    # Convert history to plain dicts for the LLM layer
    history = [{"role": m.role, "content": m.content} for m in body.history]

    # Generate reply to student query
    reply = generate_chat_response(body.message, history, progress_summary)

    # Returning llm response
    return ChatResponse(reply=reply)
