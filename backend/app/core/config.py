import os
from pathlib import Path
from pydantic import BaseModel


# A directory holding one of these is a project root. The upward walk stops there even
# when it has no .env yet: climbing past it would silently adopt an unrelated .env from
# an ancestor - a home directory, say - and point the app at another project's Supabase.
_PROJECT_ROOT_MARKERS = (".env.example", ".env.new", ".git")


def find_env_file(start: Path | None = None) -> Path:
    """Load runtime values only from the nearest .env file."""
    root_dir = Path(__file__).resolve().parents[2]
    search_roots = []
    if start is not None:
        search_roots.extend([start, *start.parents])
    search_roots.extend([Path.cwd(), root_dir, root_dir.parent])
    for root in search_roots:
        candidate = root / ".env"
        if candidate.exists():
            return candidate
        if any((root / marker).exists() for marker in _PROJECT_ROOT_MARKERS):
            return candidate
    return root_dir / ".env"


class Settings(BaseModel):
    app_name: str = "Smart Grievance Management API"
    debug: bool = True
    app_env: str = "development"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_anon_key: str = ""
    telegram_bot_token: str = ""
    storage_mode: str = "memory"
    ai_provider: str = "local_model"
    auth_mode: str = "demo"
    # When Supabase is unreachable the repositories can serve hardcoded demo records.
    # That is useful offline, and dangerous anywhere real: an operator sees invented
    # civic data with no indication it is fake. Off unless explicitly switched on.
    allow_demo_fallback: bool = False
    require_auth: bool = True
    # --- Worker app proof-of-work rules ---
    # How far from a complaint's own coordinates a worker may stand and still submit.
    # Only enforced when the complaint actually has coordinates; most Telegram complaints
    # arrive without a location pin.
    work_geofence_metres: float = 300.0
    # A phone reporting worse accuracy than this is not evidence the worker was there.
    work_max_gps_accuracy_metres: float = 200.0
    # Photos older than this were taken somewhere else, earlier - not proof of this job.
    work_photo_max_age_minutes: float = 60.0


# Values the project's .env owns outright. A stale machine-wide export of one of
# these (for example a service-role key left over from another Supabase project)
# would otherwise silently point the app at the wrong backend.
_ENV_FILE_WINS = {
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY",
    "TELEGRAM_BOT_TOKEN",
}


def _load_environment() -> None:
    env_file = find_env_file(Path(__file__).resolve())
    if not env_file.exists():
        return
    for raw_line in env_file.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if not key or not value:
            continue
        if key in _ENV_FILE_WINS or key not in os.environ:
            os.environ[key] = value


_load_environment()
settings = Settings(
    app_name=os.getenv("APP_NAME", "Smart Grievance Management API"),
    debug=os.getenv("DEBUG", "true").lower() in {"1", "true", "yes", "on"},
    app_env=os.getenv("APP_ENV", "development").lower(),
    cors_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"),
    supabase_url=os.getenv("SUPABASE_URL", ""),
    supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
    supabase_anon_key=os.getenv("SUPABASE_ANON_KEY", ""),
    telegram_bot_token=os.getenv("TELEGRAM_BOT_TOKEN", ""),
    storage_mode=os.getenv("STORAGE_MODE", "supabase" if os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_ROLE_KEY") else "memory").lower(),
    ai_provider=os.getenv("AI_PROVIDER", "local_model").lower(),
    auth_mode=os.getenv("AUTH_MODE", "demo").lower(),
    allow_demo_fallback=os.getenv("ALLOW_DEMO_FALLBACK", "false").lower() in {"1", "true", "yes", "on"},
    require_auth=os.getenv("REQUIRE_AUTH", "true").lower() in {"1", "true", "yes", "on"},
    work_geofence_metres=float(os.getenv("WORK_GEOFENCE_METRES", "300")),
    work_max_gps_accuracy_metres=float(os.getenv("WORK_MAX_GPS_ACCURACY_METRES", "200")),
    work_photo_max_age_minutes=float(os.getenv("WORK_PHOTO_MAX_AGE_MINUTES", "60")),
)
