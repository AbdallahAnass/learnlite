from pydantic import BaseModel

# Ask request schema
class AskRequest(BaseModel):
    question: str

# Ask response schema
class AskResponse(BaseModel):
    answer: str

# Summary response schema
class SummaryResponse(BaseModel):
    summary: str
