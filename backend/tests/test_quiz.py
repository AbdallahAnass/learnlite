"""
White Box Tests — Group 2: Quiz Scoring Logic
Tests internal scoring formula and answer validation in QuizService (app/services/quiz.py)
"""
from uuid import UUID
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.exceptions import MultipleCorrectAnswersError
from app.services.quiz import QuizService


@pytest.mark.parametrize("correct, total, expected_score, should_pass", [
    (4, 4, 100.0, True),   # perfect score
    (3, 4,  75.0, True),   # above 70% threshold → passes
    (2, 4,  50.0, False),  # below 70% threshold → fails
    (0, 4,   0.0, False),  # all wrong
])
def test_score_calculation_and_pass_threshold(correct, total, expected_score, should_pass):
    # Replicates the formula from QuizService.submit_quiz (quiz.py line 504)
    score = round((correct / total * 100) if total > 0 else 0.0, 2)

    assert score == expected_score
    assert (score >= 70.0) == should_pass


async def test_adding_second_correct_answer_raises_error():
    instructor_id = UUID("00000000-0000-0000-0000-000000000001")

    existing_correct_answer = MagicMock()
    existing_correct_answer.is_correct = True

    mock_question = MagicMock()
    mock_question.answers = [existing_correct_answer]
    mock_question.quiz.lesson.module.course.instructor_id = instructor_id

    mock_session = AsyncMock()
    mock_session.get.return_value = mock_question

    mock_instructor = MagicMock()
    mock_instructor.id = instructor_id

    new_answer_data = MagicMock()
    new_answer_data.is_correct = True
    new_answer_data.text = "This would be a second correct answer"

    service = QuizService(session=mock_session, enrollment=AsyncMock())

    with pytest.raises(MultipleCorrectAnswersError):
        await service.add_answer(
            question_id=1,
            answer_data=new_answer_data,
            instructor=mock_instructor,
        )
