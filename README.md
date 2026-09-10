# RaipurOne V2

Smart Grievance Management System for Raipur — a FastAPI backend, a React dashboard, a Telegram intake bot, and a Supabase (Postgres) data layer with an AI classifier for routing complaints to the right department.

## Repository layout

| Path | What it holds |
| --- | --- |
| `backend/` | FastAPI app (`app/api/routes`, `app/services`, `app/core`), Telegram intake worker, the field worker app page (`app/static/worker.html`), pytest suite |
| `dashboard-frontend/` | React admin dashboard (Create React App + Tailwind) |
| `supabase/` | `schema.sql`, `seed.sql`, migrations and `SCHEMA_GUIDE.md` |
| `notebooks/` | AI experiments and `label_mapping.json` for the grievance classifier |
| `Grievence_dataset.csv` | Labelled grievance dataset used to train the classifier |

## Planning docs

These are kept in the repo so the project can be picked up again later:

- [`PROJECT_REBUILD_GUIDE.md`](PROJECT_REBUILD_GUIDE.md) — how to rebuild the system from scratch
- [`plan.md`](plan.md) — overall product plan
- [`phases.md`](phases.md) — phased delivery breakdown
- [`stack.md`](stack.md) — chosen technology stack
- [`continuation.md`](continuation.md) — running notes on where work left off
- [`supabase/SCHEMA_GUIDE.md`](supabase/SCHEMA_GUIDE.md) — database schema reference

## Getting started

### 1. Environment

Copy the example env files and fill in your own values:

```bash
cp .env.example .env
cp dashboard-frontend/.env.example dashboard-frontend/.env
```

Required keys include `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `TELEGRAM_BOT_TOKEN`. Real `.env` files are gitignored and must never be committed.

### 2. Database

Apply `supabase/schema.sql`, `supabase/telegram_migration.sql` and
`supabase/work_submissions_migration.sql` to your Supabase project, then optionally load
`supabase/seed.sql`.

### 3. Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Telegram intake worker (run exactly one instance):

```bash
cd backend
python -m app.telegram_bot
```

### 4. Worker app

Nothing extra to install - the backend serves it at `/worker`. Open that URL on a phone on
the same network (`http://<api-host>:8000/worker`) and sign in as a worker. See
[`backend/README.md`](backend/README.md#worker-app) for the proof-of-work rules.

### 5. Frontend

```bash
cd dashboard-frontend
npm install
npm start
```

## Tests

```bash
cd backend && pytest          # backend
cd dashboard-frontend && npm test   # frontend
```

## AI model

The trained grievance classifier lives under `backend/models/grievance_classifier/`. Model weights are **not** committed (the `.safetensors` file is over 1 GB and is excluded by `.gitignore`) — retrain from `Grievence_dataset.csv` using `notebooks/ai_experiments.ipynb`, or drop your own copy of the model into that folder.
