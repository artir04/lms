# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multi-tenant Learning Management System (LMS) with a FastAPI backend and React/TypeScript frontend.

### Tech Stack

**Backend:**
- FastAPI with async SQLAlchemy 2.0 + asyncpg
- PostgreSQL 16
- Redis 7 + Celery for background tasks
- Alembic for database migrations
- JWT authentication with role-based access control

**Frontend:**
- React 18 + TypeScript + Vite
- React Router v6
- TanStack Query for data fetching
- Zustand for state management
- Tailwind CSS

## Development Commands

### Backend
```bash
cd backend
# Start all services (database, redis, backend, workers)
docker-compose up

# Run specific services
docker-compose up backend  # Just backend with uvicorn hot reload
docker-compose up worker   # Celery worker
docker-compose up beat    # Celery beat scheduler
docker-compose up seeder  # Database seed (runs once)

# Database operations
alembic revision --autogenerate -m "description"  # Create migration
alembic upgrade head                               # Apply migrations
alembic downgrade -1                               # Rollback one migration

# Run tests
pytest
```

### Frontend
```bash
cd frontend
npm run dev     # Start dev server (port 3000)
npm run build   # TypeScript check + Vite build
npm run lint    # ESLint
npm run preview # Preview production build
```

### Docker Compose
```bash
# Start all services (includes frontend with --profile full)
docker-compose --profile full up

# Services exposed on host:
# - Backend: http://localhost:8000 (FastAPI docs at /api/docs)
# - Frontend: http://localhost:3000
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
```

## Architecture

### Backend Structure
```
backend/
├── app/
│   ├── api/v1/          # FastAPI route handlers
│   ├── models/          # SQLAlchemy ORM models
│   ├── schemas/         # Pydantic schemas (request/response)
│   ├── services/        # Business logic layer
│   ├── workers/tasks/   # Celery async tasks
│   ├── core/            # Security, permissions, exceptions
│   ├── db/              # Database session, seed data
│   └── main.py          # FastAPI app factory
├── alembic/             # Database migrations
└── requirements.txt
```

**Key Patterns:**
- **Service Layer:** Business logic lives in `services/`. API routes delegate to services.
- **Dependency Injection:** Use FastAPI's `Depends()` with custom dependencies from `dependencies.py`:
  - `DbSession` - Async database session
  - `CurrentUser` - Authenticated user object
  - `require_admin()`, `require_teacher()`, `require_superadmin()` - Role checks
- **Multi-tenant:** `District` → `School` → `Users` hierarchy. Queries are filtered by tenant context.
- **Async Tasks:** Long-running operations use Celery tasks in `workers/tasks/` (analytics, notifications).

### Frontend Structure
```
frontend/src/
├── pages/           # Page components organized by feature
├── components/      # Reusable UI components
│   ├── layout/      # AppShell, navigation
│   ├── ui/          # Generic UI elements (buttons, cards)
│   └── [feature]/   # Feature-specific components
├── router/          # React Router configuration
├── store/           # Zustand stores (auth, notifications)
├── hooks/           # Custom React hooks
├── config/          # axios instance, queryClient setup
└── types/           # TypeScript type definitions
```

**Key Patterns:**
- **Role-based Routing:** Routes nested under `ProtectedRoute` components with `roles` prop.
- **Data Fetching:** Use TanStack Query with `api` from `config/axios.ts`.
- **Auth Flow:** JWT tokens stored in Zustand `authStore`. Silent token refresh on 401 via axios interceptor.
- **Routing:** Centralized in `router/index.tsx` - add new routes there, not in individual files.

## Authentication & Authorization

### Backend
- JWT access tokens (15 min) + refresh tokens (7 days)
- Role hierarchy: `student < teacher < admin < superadmin`
- Roles stored in `UserRole` junction table (many-to-many users to roles)
- Token payload includes: `sub` (user_id), `tenant_id`, `roles`, `type` (access/refresh)

### Frontend
- `authStore` manages tokens and persists to localStorage
- `useAuth()` hook provides: `user`, `hasRole()`, `isStudent/Teacher/Admin/SuperAdmin`
- `ProtectedRoute` component wraps protected routes with role checks
- Axios interceptors handle 401 → refresh token → retry flow

## Important Conventions

### Backend
- Always use async SQLAlchemy: `await db.execute(select(Model).where(...))`
- New endpoints go in `api/v1/[feature].py`
- New business logic goes in `services/[feature]_service.py`
- Use `CurrentUser` and `DbSession` dependencies, not direct imports
- Background tasks go in `workers/tasks/[feature].py`
- Return Pydantic schemas, never raw ORM objects from endpoints

### Frontend
- Use path alias `@/` for imports (configured in vite.config.ts)
- New pages go in `pages/[feature]/`
- Feature components in `components/[feature]/`
- Use TanStack Query for all API calls (no manual fetch/axios)
- Tailwind classes use slate shades for consistent theming
- State in Zustand stores, not Context API
- Form validation: react-hook-form + zod

## Environment Configuration

**Backend (.env):**
- Required: `SECRET_KEY`, `DATABASE_URL`
- Default credentials: `SUPERADMIN_EMAIL=superadmin@lms.example.com`, `SUPERADMIN_PASSWORD=SuperAdmin123!`

**Frontend (.env):**
- `VITE_API_BASE_URL=http://backend:8000` (or http://localhost:8000 for local dev without docker)

## Default Superadmin
Seeded on first run:
- Email: `superadmin@lms.example.com`
- Password: `SuperAdmin123!`
