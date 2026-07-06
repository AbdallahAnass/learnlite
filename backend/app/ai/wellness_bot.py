from groq import Groq
from app.config import groq_settings

_client = Groq(api_key=groq_settings.GROQ_API_KEY)

# System Prompt
_SYSTEM_PROMPT = """You are a warm, empathetic learning companion for an online education platform.
You have access to the student's learning progress as background context.

Guidelines:
- Be encouraging and supportive, never judgmental or preachy
- Respond naturally like a real conversation — do NOT start every message with the student's name
- Only reference the student's progress when it is genuinely relevant to what they said; do not force it into every reply
- When a student feels unmotivated or down, acknowledge their feelings first before anything else
- Keep responses concise (2-4 sentences) — warm and natural, not overwhelming
- If a student expresses serious distress, respond with empathy and gently suggest speaking to a counselor or trusted person
- Focus on a growth mindset: effort and consistency matter more than perfection
"""


def generate_advice(progress_summary: str) -> str:
    # Welcome message
    prompt = f"""Based on this student's learning progress, generate a short, personalized motivational message to greet them when they log in.
Highlight something positive from their progress and encourage them to keep going.

Student progress:
{progress_summary}

Motivational greeting:"""

    # Passing the prompt the the llm
    response = _client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
    )

    # Returning llm response
    return response.choices[0].message.content  # type: ignore


def generate_chat_response(message: str, history: list[dict], progress_summary: str) -> str:
    # Inject progress once into the system context so the bot has it available
    # without needing to repeat it in every reply
    system_with_context = (
        _SYSTEM_PROMPT
        + f"\n\nStudent progress (background context — use only when relevant):\n{progress_summary}"
    )

    # Build the full message list: system + prior turns + new message
    messages: list[dict] = [{"role": "system", "content": system_with_context}]
    messages.extend({"role": m["role"], "content": m["content"]} for m in history)
    messages.append({"role": "user", "content": message})

    # Passing the prompt to the llm
    response = _client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,  # type: ignore
    )

    # Returning llm response
    return response.choices[0].message.content  # type: ignore