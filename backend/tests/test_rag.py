"""
White Box Tests — Group 4: RAG Pipeline
Tests the AI pipeline components: chunker, LLM classifier, and pipeline orchestration
"""
from unittest.mock import MagicMock, patch

from app.ai.chunker import chunk_text
from app.ai.llm import is_course_question
from app.ai.pipeline import ingest_lesson


def test_chunk_text_splits_long_text_into_multiple_chunks():
    # 600 chars exceeds the 512-char chunk_size, so must produce more than 1 chunk
    long_text = "word " * 120
    chunks = chunk_text(long_text)

    assert len(chunks) > 1


def test_chunk_text_short_text_returns_single_chunk():
    short_text = "This is a short sentence about machine learning."
    chunks = chunk_text(short_text)

    assert len(chunks) == 1
    assert chunks[0] == short_text


def _mock_groq_response(label: str):
    mock_response = MagicMock()
    mock_response.choices[0].message.content = label
    return mock_response


def test_is_course_question_returns_true_for_learning_topic():
    with patch("app.ai.llm._client") as mock_client:
        mock_client.chat.completions.create.return_value = _mock_groq_response("course")

        result = is_course_question("What is a neural network?")

        assert result is True


def test_is_course_question_returns_false_for_small_talk():
    with patch("app.ai.llm._client") as mock_client:
        mock_client.chat.completions.create.return_value = _mock_groq_response("general")

        result = is_course_question("How are you doing today?")

        assert result is False


def test_ingest_pipeline_calls_extract_chunk_and_index_in_order():
    with patch("app.ai.pipeline.extract_pdf_text", return_value="extracted text") as mock_extract, \
         patch("app.ai.pipeline.chunk_text", return_value=["chunk1", "chunk2"]) as mock_chunk, \
         patch("app.ai.pipeline.index_lesson") as mock_index:

        ingest_lesson(
            lesson_id=1,
            course_id=1,
            lesson_title="Intro to ML",
            file_path="storage/lesson1.pdf",
            lesson_dir="storage/",
            content_type="pdf",
        )

        mock_extract.assert_called_once_with("storage/lesson1.pdf", "storage/")
        mock_chunk.assert_called_once_with("extracted text")
        mock_index.assert_called_once_with(1, 1, "Intro to ML", ["chunk1", "chunk2"])
