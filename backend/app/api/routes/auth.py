import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.config import settings

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    role: str = "citizen"


def _supabase_headers() -> dict[str, str]:
    return {"apikey": settings.supabase_anon_key, "Content-Type": "application/json"}


@router.post("/login")
def login(payload: LoginRequest):
    if settings.auth_mode == "supabase":
        if not settings.supabase_url or not settings.supabase_anon_key:
            raise HTTPException(status_code=503, detail="Supabase Auth is not configured")
        try:
            response = httpx.post(settings.supabase_url.rstrip("/") + "/auth/v1/token?grant_type=password", headers=_supabase_headers(), json={"email": payload.username, "password": payload.password}, timeout=10)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=401, detail="Invalid credentials") from exc
    return {"access_token": f"demo-token-{payload.username}", "token_type": "bearer", "role": "citizen"}


@router.post("/register")
def register(payload: RegisterRequest):
    if settings.auth_mode == "supabase":
        if not settings.supabase_url or not settings.supabase_anon_key:
            raise HTTPException(status_code=503, detail="Supabase Auth is not configured")
        try:
            response = httpx.post(settings.supabase_url.rstrip("/") + "/auth/v1/signup", headers=_supabase_headers(), json={"email": payload.username, "password": payload.password, "data": {"role": payload.role}}, timeout=10)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=400, detail="Registration failed") from exc
    return {"message": "user registered", "status": "ok", "username": payload.username, "role": payload.role}
