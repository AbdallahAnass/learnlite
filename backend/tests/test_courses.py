"""
White Box Tests — Group 3: Course Publication Validation
Tests the internal _check_publish_requirements method in CourseService (app/services/course.py)
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.database.models import ContentType
from app.services.course import CourseService


def make_service():
    return CourseService(session=AsyncMock(), enrollment=AsyncMock())


def make_module(title: str, lesson_types: list, has_video_file: bool = False):
    lessons = []
    for ctype in lesson_types:
        lesson = MagicMock()
        lesson.content_type = ctype
        lesson.file_url = "fake/video.mp4" if ctype == ContentType.video and has_video_file else None
        lessons.append(lesson)

    module = MagicMock()
    module.title = title
    module.lessons = lessons
    return module


async def test_publish_fails_when_course_has_no_modules():
    service = make_service()
    mock_course = MagicMock()
    mock_course.modules = []

    issues = await service._check_publish_requirements(mock_course)

    assert len(issues) > 0
    assert any("no modules" in issue for issue in issues)


async def test_publish_fails_when_module_has_no_quiz():
    service = make_service()
    module = make_module("Module 1", [ContentType.pdf])
    mock_course = MagicMock()
    mock_course.modules = [module]

    issues = await service._check_publish_requirements(mock_course)

    assert any("quiz" in issue for issue in issues)


async def test_publish_fails_when_total_video_duration_under_3_hours():
    service = make_service()
    # Module satisfies content + quiz requirements, but video is only 1 hour
    module = make_module("Module 1", [ContentType.video, ContentType.quiz], has_video_file=True)
    mock_course = MagicMock()
    mock_course.modules = [module]

    with patch("asyncio.to_thread", new_callable=AsyncMock, return_value=3600.0):  # 1 hour
        issues = await service._check_publish_requirements(mock_course)

    assert any("3h" in issue for issue in issues)
