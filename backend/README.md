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
