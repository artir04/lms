# EduDitari LMS

A full-stack Learning Management System built with **FastAPI** + **React**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | FastAPI, SQLAlchemy (async), Alembic |
| Database | PostgreSQL |
| Cache / Queue | Redis, Celery |
| Auth | JWT (access + refresh tokens) |
| Containerisation | Docker Compose |

---

## Project Structure

```
lms/
├── backend/          # FastAPI application
│   ├── app/
│   │   ├── api/      # Route handlers (v1)
│   │   ├── models/   # SQLAlchemy ORM models
│   │   ├── schemas/  # Pydantic request/response schemas
│   │   ├── services/ # Business logic
│   │   ├── workers/  # Celery async tasks
│   │   └── core/     # Auth, permissions, pagination
│   └── alembic/      # Database migrations
├── frontend/         # React SPA
│   └── src/
│       ├── api/      # React Query hooks
│       ├── components/
│       ├── pages/
│       ├── store/    # Zustand auth store
│       └── router/
└── docker-compose.yml
```

---

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Docker Compose v2+

### Run with Docker

```bash
# Clone the repo
git clone <repo-url>
cd lms

# Copy and configure environment
cp backend/.env.example backend/.env   # edit values as needed
cp frontend/.env.example frontend/.env

# Start all services
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |

### Run Locally (without Docker)

**Backend**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Set environment variables (see backend/.env.example)
alembic upgrade head
uvicorn app.main:app --reload
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL async connection string |
| `REDIS_URL` | Redis connection string |
| `SECRET_KEY` | JWT signing secret |
| `MEDIA_ROOT` | Local file upload directory |

---

## Roles & Permissions

| Role | Access |
|---|---|
| `student` | Courses, lessons, quizzes (published only), own grades |
| `teacher` | + Course editor, quiz builder, gradebook, analytics |
| `admin` | + User management, all tenant data |
| `superadmin` | Full access across tenants |

---

## Database Migrations

```bash
# Generate a new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback one step
alembic downgrade -1
```

---

## Seed Data

```bash
docker compose exec backend python -m app.db.seed
```

Creates a demo tenant (`lincoln-unified`) with admin, teacher, and student accounts.
