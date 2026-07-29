# Smart Grievance Management System — Rebuild Guide

This document exists so the project can be rebuilt from scratch with the same intent, structure, and working conventions.

## 1. Project purpose

The Smart Grievance Management System is a civic complaint management platform for cities and municipalities. It allows citizens to submit grievances, administrators to review and assign them, and workers to act on assigned tickets.

The system is designed around a phased delivery model:
- Phase 1: polished public-facing website experience
- Phase 2: workflow backend with complaint lifecycle logic
- Phase 3: database-ready persistence and Supabase schema preparation

## 2. Core product goals

The system should support the following user journeys:
- A citizen submits a complaint with title, category, description, and optional image context.
- The complaint enters a review pipeline that can be classified and prioritized.
- Administrators can review queue state, assign complaints to workers, and manage notifications.
- Workers can see assigned tasks and update their status.
- Notifications and AI-guided recommendations support operational decisions.

## 3. Project structure

The repository is organized into three main areas:

- web/: Next.js frontend application
- backend/: FastAPI API server
- supabase/: SQL schema and seed files

### Web frontend
The frontend is a Next.js application using TypeScript and Tailwind CSS.

Key areas:
- app/page.tsx: landing experience
- app/complaints/page.tsx: complaint intake flow
- app/admin/page.tsx: admin operations dashboard
- app/worker/page.tsx: worker task board
- app/admin/notifications/page.tsx: notifications panel
- lib/api.ts: shared API client helpers

### Backend
The backend is a FastAPI service exposing complaint, auth, AI, notifications, and Telegram routes.

Key areas:
- app/main.py: application entrypoint and CORS config
- api/routes/complaints.py: complaint lifecycle endpoints
- api/routes/ai.py: classification and worker recommendation helpers
- api/routes/notifications.py: notification operations
- api/routes/telegram.py: webhook-style message intake
- services/repository.py: persistence abstraction for local or Supabase-backed storage

### Supabase assets
The database phase includes SQL schema and seed data:
- schema.sql: table definitions, starter policies, and base schema
- seed.sql: example complaints and notifications
- SCHEMA_GUIDE.md: human-readable schema explanation

## 4. Tech stack

### Frontend
- Next.js
- TypeScript
- Tailwind CSS
- React

### Backend
- Python
- FastAPI
- Pydantic
- Uvicorn
- HTTPX
- pytest

### Database / persistence
- PostgreSQL-compatible schema for Supabase
- Optional REST API integration via Supabase

## 5. Runtime behavior

### Complaint flow
A complaint is expected to move through the following lifecycle in the app:
1. Citizen submits complaint
2. Complaint is stored in repository
3. System generates AI-style classification and worker recommendation context
4. Admin reviews or assigns the complaint
5. Worker updates progress and completion status
6. Notifications are created for operational updates

### Admin experience
The admin experience is intended to help with:
- viewing the complaint queue
- changing complaint priority and state
- assigning tasks to workers
- monitoring notifications

### Worker experience
The worker experience is designed to:
- show assigned tasks
- let a worker start or complete a task
- surface task context from the complaint object

## 6. Backend API surface

The backend exposes these primary routes:

### Health
- GET /health

### Auth
- POST /auth/login
- POST /auth/register

### Complaints
- GET /complaints/
- POST /complaints/
- GET /complaints/{complaint_id}
- POST /complaints/{complaint_id}/status
- POST /complaints/{complaint_id}/assign

### AI
- POST /ai/classify
- POST /ai/recommend-worker

### Notifications
- GET /notifications/
- POST /notifications/

### Telegram
- POST /telegram/webhook

## 7. Repository design

The persistence layer is intentionally abstracted so the app does not depend directly on a single storage backend.

Current implementations:
- InMemoryComplaintRepository: used as the default local fallback
- SupabaseComplaintRepository: prepared for connection to a Supabase project

The repository abstraction keeps the API logic stable while enabling later swap-in of real persistence.

## 8. Environment configuration

The app expects a root-level environment file named .env.

Example configuration:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
```

The backend reads this file at startup so that the frontend and API share the same local configuration.

## 9. Local development workflow

### Backend setup
1. Create and activate a Python virtual environment.
2. Install dependencies from backend/requirements.txt.
3. Start the API with UVicorn.

Example:
```bash
python -m venv .venv-backend
.venv-backend\Scripts\activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

### Frontend setup
1. Enter the web folder.
2. Install npm packages.
3. Start the Next.js development server.

Example:
```bash
cd web
npm install
npm run dev
```

## 10. Testing strategy

Backend tests are included for the core workflow layers.

Test files:
- backend/tests/test_complaints.py
- backend/tests/test_repository.py

Run tests with:
```bash
pytest backend/tests/test_complaints.py backend/tests/test_repository.py
```

Frontend build verification:
```bash
cd web
npm run build
```

## 11. Supabase import instructions

To rebuild the database in Supabase:
1. Open the Supabase SQL editor.
2. Run the contents of supabase/schema.sql.
3. Run the contents of supabase/seed.sql.

This creates the initial tables, policies, and example records required by the app.

## 12. Notes for future maintainers

When rebuilding the project:
- Preserve the phased approach rather than mixing phases prematurely.
- Keep the frontend and backend contract stable.
- Favor the repository abstraction over direct in-memory logic when moving to production persistence.
- Keep the UI and API separated so the experience remains easy to evolve.
- Use the SQL files as the source of truth for the database phase.

## 13. Recommended rebuild order

1. Create the frontend Next.js app and copy the current routes and UI components.
2. Create the FastAPI backend and expose the complaint routes.
3. Add the AI/notifications/telegram routes and the repository abstraction.
4. Create the .env file and load it in the backend.
5. Import the Supabase schema and seed data.
6. Run tests and build verification.

## 14. Summary

This project is a phased civic complaint management system with:
- a polished public-facing website experience,
- a real backend workflow,
- AI-assisted recommendations,
- notification handling,
- and database-ready persistence prepared for Supabase.

If rebuilt carefully, it should preserve the functionality of the current implementation while remaining extensible for more advanced civic operations later.
