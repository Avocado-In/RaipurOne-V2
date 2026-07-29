import os
from pathlib import Path
from pydantic import BaseModel


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
    ai_provider: str = "rule_based"
    auth_mode: str = "demo"


def _load_environment() -> None:
    env_file = find_env_file(Path(__file__).resolve())
    if not env_file.exists():
        return
    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
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
    ai_provider=os.getenv("AI_PROVIDER", "rule_based").lower(),
    auth_mode=os.getenv("AUTH_MODE", "demo").lower(),
)
