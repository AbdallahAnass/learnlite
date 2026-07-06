# 🎓 Learning Platform

A full-stack e-learning platform with course management, quizzes, role-based dashboards, and AI-powered features (RAG-based course assistant + wellness chatbot).

**Stack:** ⚡ FastAPI · 🐘 PostgreSQL · 🟥 Redis · 🔎 ChromaDB · 🧠 Groq · ⚛️ React · 🎨 Tailwind CSS

---

## 📁 Repository structure

This is a monorepo containing both services as separate projects:

```
.
├── backend/     # FastAPI backend — see backend/README.md
└── frontend/    # React frontend — see frontend/README.md
```

Each service has its own README with full setup instructions:

- [`backend/README.md`](./backend/README.md) — API server, database, environment variables, testing
- [`frontend/README.md`](./frontend/README.md) — UI app, roles, project structure

---

## 🏗️ Architecture

```
┌─────────────────┐        HTTP (REST)        ┌──────────────────┐
│  React Frontend  │ ────────────────────────► │  FastAPI Backend │
│  localhost:3000  │ ◄──────────────────────── │  localhost:8000  │
└─────────────────┘                            └────────┬─────────┘
                                                          │
                                        ┌─────────────────┼─────────────────┐─────────────────┐
                                        ▼                 ▼                 ▼                 ▼
                                  PostgreSQL           Redis            ChromaDB           Groq API
                                  (data store)     (token blacklist)  (vector store)         (LLM)

```

---

## 🚀 Quick start

Run both services in separate terminals.

**1. Backend**

```bash
cd backend
# follow setup steps in learning-backend/README.md
uvicorn app.main:app --reload
```

**2. Frontend**

```bash
cd frontend
# follow setup steps in learning-frontend/README.md
npm start
```

The frontend (`http://localhost:3000`) expects the backend to be running on `http://localhost:8000`. Once both are running, open `http://localhost:3000` to use the app. 🎉

---

## 👥 User roles

| Role              | Description                                                           |
| ----------------- | --------------------------------------------------------------------- |
| 🎓 **Student**    | Browse courses, enroll, view lessons, take quizzes, use wellness chat |
| 👨‍🏫 **Instructor** | Create/manage courses, modules, lessons, and quizzes                  |
| 🛡️ **Admin**      | Manage platform-wide users and courses                                |

---

## ✅ Prerequisites summary

| Service     | Requirements                           |
| ----------- | -------------------------------------- |
| ⚙️ Backend  | Python 3.12+, PostgreSQL 14+, Redis 6+ |
| 💻 Frontend | Node.js 18+, npm 9+                    |

Full installation and configuration steps are in each service's own README.

---

## 🤝 Contributing

Contributions are welcome! To get started:

1. **Fork** the repository and clone it locally.
2. **Create a branch** for your change:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Set up both services** by following the setup steps in `backend/README.md` and `frontend/README.md`.
4. **Make your changes**, keeping commits focused and descriptive.
5. **Test your changes**:
   - Backend: `pytest`
   - Frontend: verify the app runs with `npm start` and check for console errors.
6. **Commit and push**:
   ```bash
   git commit -m "Add: short description of your change"
   git push origin feature/your-feature-name
   ```
7. **Open a Pull Request** describing what you changed and why.

### Guidelines

- Keep PRs focused on a single feature or fix.
- Follow the existing code style in each project.
- Update relevant documentation (README, comments) when behavior changes.
- Be respectful and constructive in code reviews. 🙌

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE) — feel free to use any template for personal or commercial projects.

## ⭐ Support

If you find these templates useful, consider giving this repo a star — it helps others discover it too!
