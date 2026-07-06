"""
White Box Tests — Group 1: Authentication & Security
Tests internal logic of AuthService (app/services/auth.py)
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import jwt
import pytest
from fastapi import HTTPException

from app.services.auth import AuthService, password_context

TEST_SECRET = "test-secret-key-for-testing"
TEST_ALGORITHM = "HS256"


def test_password_is_hashed_not_stored_in_plain_text():
    plain = "MySecurePassword123"
    hashed = password_context.hash(plain)

    assert hashed != plain


def test_correct_password_verifies_successfully():
    plain = "MySecurePassword123"
    hashed = password_context.hash(plain)

    assert password_context.verify(plain, hashed) is True


def test_wrong_password_fails_verification():
    hashed = password_context.hash("correct-password")

    assert password_context.verify("wrong-password", hashed) is False


def test_generated_token_decodes_to_correct_payload():
    with patch("app.services.auth.security_settings") as mock_settings:
        mock_settings.JWT_SECRET = TEST_SECRET
        mock_settings.JWT_ALGORITHM = TEST_ALGORITHM

        service = AuthService(session=MagicMock())
        token = service._generate_access_token({"user_id": "abc-123", "user_role": "student"})
        decoded = AuthService.decode_token(token)

        assert decoded["user_id"] == "abc-123"
        assert decoded["user_role"] == "student"
        assert "jti" in decoded


def test_expired_token_raises_401():
    expired_token = jwt.encode(
        {"user_id": "abc", "exp": datetime.now(timezone.utc) - timedelta(hours=1)},
        TEST_SECRET,
        algorithm=TEST_ALGORITHM,
    )

    with patch("app.services.auth.security_settings") as mock_settings:
        mock_settings.JWT_SECRET = TEST_SECRET
        mock_settings.JWT_ALGORITHM = TEST_ALGORITHM

        with pytest.raises(HTTPException) as exc_info:
            AuthService.decode_token(expired_token)

        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Token Expired"


def test_invalid_token_raises_401():
    with patch("app.services.auth.security_settings") as mock_settings:
        mock_settings.JWT_SECRET = TEST_SECRET
        mock_settings.JWT_ALGORITHM = TEST_ALGORITHM

        with pytest.raises(HTTPException) as exc_info:
            AuthService.decode_token("this.is.not.a.valid.token")

        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Token Invalid"
