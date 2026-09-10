# RaipurOne V2

Smart Grievance Management System for Raipur — a FastAPI backend, a React dashboard, a Telegram intake bot, and a Supabase (Postgres) data layer with an AI classifier for routing complaints to the right department.

## Repository layout

| Path | What it holds |
| --- | --- |
| `backend/` | FastAPI app (`app/api/routes`, `app/services`, `app/core`), Telegram intake worker, the field worker app page (`app/static/worker.html`), pytest suite |
| `dashboard-frontend/` | React admin dashboard (Create React App + Tailwind) |
| `supabase/` | `schema.sql`, `seed.sql`, migrations and `SCHEMA_GUIDE.md` |
| `worker-app/` | Capacitor wrapper that packages the worker page as an Android APK |
| `notebooks/` | AI experiments and `label_mapping.json` for the grievance classifier |
| `Grievence_dataset.csv` | Labelled grievance dataset used to train the classifier |

## Planning docs

These are kept in the repo so the project can be picked up again later:

- [`PROJECT_REBUILD_GUIDE.md`](PROJECT_REBUILD_GUIDE.md) — how to rebuild the system from scratch
- [`plan.md`](plan.md) — overall product plan
- [`phases.md`](phases.md) — phased delivery breakdown
- [`stack.md`](stack.md) — chosen technology stack
- [`RUNBOOK.md`](RUNBOOK.md) — starting the system, and every error it produces
- [`continuation.md`](continuation.md) — running notes on where work left off
- [`supabase/SCHEMA_GUIDE.md`](supabase/SCHEMA_GUIDE.md) — database schema reference

## Running it

**[`RUNBOOK.md`](RUNBOOK.md) is the page to open when something will not start.** It has
the commands, the logins, and every error this system actually produces with what each
one means.

On Windows, one command starts the API, the dashboard and the Telegram bot, each in its
own window:

```powershell
.\start.ps1           # start everything
.\start.ps1 -Stop     # stop everything
.\start.ps1 -Phone    # also arm the USB tunnel for the worker app
```

The manual steps behind that script are below.

## Getting started

### 1. Environment

Copy the example env files and fill in your own values:

```bash
cp .env.example .env
cp dashboard-frontend/.env.example dashboard-frontend/.env
```

Required keys include `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `TELEGRAM_BOT_TOKEN`. Real `.env` files are gitignored and must never be committed.

### 2. Database

Apply `supabase/schema.sql`, `supabase/telegram_migration.sql`,
`supabase/work_submissions_migration.sql`, `supabase/broadcasts_migration.sql` and
`supabase/telegram_subscribers_migration.sql` to your Supabase project, then optionally
load `supabase/seed.sql`.

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

The backend serves it at `/worker`, so opening `http://<api-host>:8000/worker` in a
browser is enough to try it. For real field use install
[`worker-app/RaipurOne-Worker.apk`](worker-app/) instead: browsers refuse GPS on a
plain-http address, and the app does not. See
[`worker-app/README.md`](worker-app/README.md) for installing and rebuilding it, and
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
