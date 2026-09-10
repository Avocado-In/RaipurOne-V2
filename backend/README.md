# Backend

The backend provides the FastAPI API and a standalone Telegram intake worker.

## Start the API

```powershell
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

## Start the Telegram bot

Run exactly one worker. It reads `TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` from the project-root `.env` file.

```powershell
cd backend
python -m app.telegram_bot
```

Every accepted Telegram text, caption, or location complaint is written to `public.complaints` through the strict Supabase repository. A notification is also created. The worker refuses to start if Supabase configuration is missing and prevents duplicate local instances with a lock file.

The AI provider remains behind `app.services.ai_service.AIProvider`; replace the provider implementation with the RoBERTa service later.

## Worker app

Field workers get their own mobile page at **`/worker`** on the API host (for example
`http://192.168.1.5:8000/worker`). It is a single static page served by FastAPI - no build
step, no separate deployment. A worker opens it on their phone and signs in with the same
`public.users` credentials the dashboard uses; only accounts with a matching row in
`public.workers` are let in.

### The loop

1. An administrator assigns a complaint to a worker from the dashboard.
2. The worker sees it under **Mere Kaam** and taps it.
3. To submit, the worker must attach **a fresh photo of the finished work** and **capture
   their GPS position**. Neither is optional - the submit button stays disabled until both
   are present, and the server refuses the request if either is missing.
4. The complaint moves to `under_review` and appears on the dashboard under
   **Worker Submissions**.
5. The administrator approves (complaint -> `resolved`, and the citizen who filed it on
   Telegram gets the resolved message) or rejects with a reason (complaint ->
   `in_progress`, and the worker sees the reason on their task).

### What the server checks before accepting a submission

| Rule | Setting | Why |
| --- | --- | --- |
| Worker owns the task | - | A worker may only submit complaints assigned to them. |
| No duplicate pending work | - | One complaint cannot sit in the review queue twice. |
| GPS accuracy | `WORK_MAX_GPS_ACCURACY_METRES` (200m) | A fix vaguer than this is not evidence of presence. |
| Distance to site | `WORK_GEOFENCE_METRES` (300m) | Only enforced when the complaint has coordinates. Most Telegram complaints arrive without a location pin, so those submissions are accepted and flagged `location_verified = false` rather than blocked. |
| Photo freshness | `WORK_PHOTO_MAX_AGE_MINUTES` (60) | Uses the file's last-modified time, which for a camera capture is when the photo was taken. Stops a gallery picture standing in for the job. |
| Photo type and size | - | Images only, under 8 MB. |

Photos land in the same private `complaint-images` bucket as citizen photos, so they also
show up on the complaint itself. The dashboard reads them back through signed URLs.

### Setup

Run `supabase/work_submissions_migration.sql` once against the project database. Until
that table exists the app loads and lists tasks, but submitting returns a 503 naming the
migration.
