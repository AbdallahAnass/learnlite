from pydantic import BaseModel


# Advice response schema
class AdviceResponse(BaseModel):
    advice: str


# A single turn in the conversation
class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str


# Chat request schema
class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


# Chat response schema
class ChatResponse(BaseModel):
    reply: str
