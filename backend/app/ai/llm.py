from groq import Groq

from app.config import groq_settings

_client = Groq(api_key=groq_settings.GROQ_API_KEY)
_MODEL = "llama-3.3-70b-versatile"


def is_course_question(question: str) -> bool:
    """Returns True if the question is about course content, False if it's general/conversational."""

    # Passing the question to the llm
    response = _client.chat.completions.create(
        model=_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a classifier. Decide if the user's message is asking about "
                    "course content/learning material, or if it is general conversation "
                    "(greetings, personal questions, small talk, etc.).\n"
                    "Reply with exactly one word: 'course' or 'general'."
                ),
            },
            {"role": "user", "content": question},
        ],
        max_tokens=5,
        temperature=0,
    )

    # Getting response
    label = response.choices[0].message.content.strip().lower()  # type: ignore

    # Return True or False based on the question
    return label == "course"


def is_relevant_to_course(question: str, chunks: list[dict]) -> bool:
    """Returns True if the question is within the subject area of this course."""

    # Combining chunks into a single string
    topics = "\n".join(f"- {chunk['lesson_title']}" for chunk in chunks[:6])

    # Passing user question to the llm
    response = _client.chat.completions.create(
        model=_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a relevance classifier. "
                    "Given a list of lesson titles from a course and a student question, "
                    "decide whether the question is relevant to the course's subject area. "
                    "A question is relevant if it is about the same domain or field as the course topics, "
                    "even if that exact topic is not listed. "
                    "Reply with exactly one word: 'relevant' or 'irrelevant'."
                ),
            },
            {
                "role": "user",
                "content": f"Course lesson titles:\n{topics}\n\nStudent question: {question}",
            },
        ],
        max_tokens=5,
        temperature=0,
    )

    # Returning true or false based on the question is relevant to the course or not
    return response.choices[0].message.content.strip().lower() == "relevant"  # type: ignore


def generate_answer(question: str, chunks: list[dict]) -> str:
    context_parts = []

    # Looping over each chunk
    for chunk in chunks:
        # Adding lesson title to each chunk
        context_parts.append(f"[Lesson: {chunk['lesson_title']}]\n{chunk['text']}")

    # Converting the chunks into a single string
    context = "\n\n".join(context_parts)

    prompt = f"""You are a helpful course assistant for an online learning platform.
Use the context below as your primary source to answer the student's question.
Write the answer in natural, flowing sentences. When referencing course material, cite the lesson naturally using phrases like "according to", "as mentioned in", "as covered in", "based on", etc., and make only the lesson title bold. Example: "according to the Lesson: **Introduction to Variables**, a variable is a container for data." Do not use brackets or any special citation markers.
If the specific answer is not in the context but the topic is within the course's subject area, answer from your own knowledge without citing any lesson.

Context:
{context}

Question: {question}
Answer:"""

    # Passing  question and context to the llm
    response = _client.chat.completions.create(
        model=_MODEL,
        messages=[{"role": "user", "content": prompt}],
    )

    # Returning llm response
    return response.choices[0].message.content  # type: ignore


def generate_general_answer(question: str) -> str:
    """Answer a general/conversational question without course context."""

    # Passed question to the llm
    response = _client.chat.completions.create(
        model=_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a friendly assistant on an online learning platform called LearnLite. "
                    "Answer the user's message naturally and helpfully. "
                    "If they ask about courses or learning topics, encourage them to ask course-specific questions."
                ),
            },
            {"role": "user", "content": question},
        ],
    )

    # Returning the llm answer
    return response.choices[0].message.content  # type: ignore
