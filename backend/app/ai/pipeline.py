from app.ai.chunker import chunk_text
from app.ai.embedder import index_lesson
from app.ai.extractors import extract_pdf_text, extract_video_transcript


def ingest_lesson(lesson_id: int, course_id: int, lesson_title: str, file_path: str, lesson_dir: str, content_type: str) -> None:
    # Extract text based on content type
    if content_type == "pdf":
        text = extract_pdf_text(file_path, lesson_dir)
    elif content_type == "video":
        text = extract_video_transcript(file_path, lesson_dir)
    else:
        return

    # If no text is found
    if not text.strip():
        return

    # Chunk text
    chunks = chunk_text(text)

    # Index text into ChromaDB
    index_lesson(lesson_id, course_id, lesson_title, chunks)
