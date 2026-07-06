# Learning Platform — Backend

FastAPI backend for the learning platform, with PostgreSQL, Redis, ChromaDB, and Groq-powered AI features.

---

## Prerequisites

| Tool | Version |
| Python | 3.12+ |
| PostgreSQL | 14+ |
| Redis | 6+ |

---

## Setup

### 1. Create a virtual environment

```bash
python -m venv myenv
source myenv/bin/activate  # Windows: myenv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install fastapi sqlmodel asyncpg redis pydantic pydantic-settings \
  uvicorn python-multipart email-validator PyJWT passlib argon2-cffi \
  groq chromadb httpx rich scalar-fastapi openai-whisper \
  pytest pytest-asyncio pytest-cov
```

### 3. Configure environment variables

Create a `.env` file in the `learning-backend/` directory:

```env
# PostgreSQL
POSTGRES_SERVER=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=learnlite

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_ALGORITHM=HS256

# Admin account
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_admin_password

# Groq (AI features)
GROQ_API_KEY=your_groq_api_key
```

### 4. Create the database

```bash
psql -U postgres -c "CREATE DATABASE learnlite;"
```

> Database tables are created automatically on server startup — no migrations needed.

### 5. Start Redis

```bash
redis-server
```

---

## Running the server

```bash
uvicorn app.main:app --reload
```

The server starts on `http://localhost:8000` by default.

---

## API Documentation

| UI                   | URL                          |
| -------------------- | ---------------------------- |
| Scalar (recommended) | http://localhost:8000/scalar |
| Swagger              | http://localhost:8000/docs   |

## Running tests

```bash
pytest
```

With coverage:

```bash
pytest --cov=app --cov-report=term-missing
```

---

## Project structure

```
learning-backend/
├── app/
│   ├── main.py               # FastAPI app entry point
│   ├── config.py             # Settings loaded from .env
│   ├── api/
│   │   ├── router.py         # Master router
│   │   ├── dependencies.py   # Auth & injection dependencies
│   │   ├── routers/          # Endpoint handlers
│   │   └── schemas/          # Pydantic request/response models
│   ├── services/             # Business logic
│   ├── database/
│   │   ├── models.py         # SQLModel table definitions
│   │   ├── session.py        # Async DB engine & session
│   │   └── redis.py          # Redis token blacklist
│   ├── core/
│   │   ├── exceptions.py     # Custom error classes
│   │   └── security.py       # JWT utilities
│   └── ai/                   # RAG & LLM features (Groq + ChromaDB)
├── storage/
│   └── courses/              # Uploaded course files (auto-created)
├── chroma_db/                # ChromaDB vector store (auto-created)
├── tests/                    # Pytest test suite
└── .env                      # Environment variables (not committed)
```
