#!/usr/bin/env bash
# Start the Telegram bot pointed at the API for classification, so only the API process
# holds the model in memory.
cd "$(dirname "$0")"
export AI_SERVICE_URL="${AI_SERVICE_URL:-http://127.0.0.1:8000}"
export PYTHONIOENCODING=utf-8
exec python -m app.telegram_bot
