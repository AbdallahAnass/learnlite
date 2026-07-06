from groq import Groq
from app.config import groq_settings

_client = Groq(api_key=groq_settings.GROQ_API_KEY)


def generate_summary(transcript: str) -> str:
    # Prompt for the llm
    prompt = f"""You are a helpful assistant for an online learning platform.
Read the following video transcript and generate a concise summary as a list of bullet points.
Each bullet point should capture a key concept, idea, or takeaway from the lesson.

Transcript:
{transcript}

Summary (bullet points):"""
    
    # Sending prompt to the llm
    response = _client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
    )
    
    # Returning the llm response for the user
    return response.choices[0].message.content  # type: ignore
