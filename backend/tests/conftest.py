import os
import sys
from unittest.mock import MagicMock

# Set required env vars before any app module imports
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-testing")
os.environ.setdefault("JWT_ALGORITHM", "HS256")
os.environ.setdefault("POSTGRES_SERVER", "localhost")
os.environ.setdefault("POSTGRES_PORT", "5432")
os.environ.setdefault("POSTGRES_USER", "test_user")
os.environ.setdefault("POSTGRES_PASSWORD", "test_pass")
os.environ.setdefault("POSTGRES_DB", "test_db")
os.environ.setdefault("REDIS_HOST", "localhost")
os.environ.setdefault("REDIS_PORT", "6379")
os.environ.setdefault("GROQ_API_KEY", "test-groq-key")

# Mock heavy ML libraries so tests don't load actual models
sys.modules.setdefault("sentence_transformers", MagicMock())
sys.modules.setdefault("chromadb", MagicMock())
sys.modules.setdefault("chromadb.utils", MagicMock())
sys.modules.setdefault("chromadb.utils.embedding_functions", MagicMock())
sys.modules.setdefault("whisper", MagicMock())
sys.modules.setdefault("PyPDF2", MagicMock())
