"""Authentication and role-based authorization.

Before this module existed the API had no auth at all: any anonymous caller could list
every citizen's complaint, create workers, reassign work, or force a complaint to any
status. ``auth.py`` handed out ``demo-token-<username>`` strings that nothing validated.

Identity lives in the deployed ``public.users`` table (``username``, ``password_hash``,
``role``, ``trust_score``) rather than Supabase Auth, because ``auth_user_id`` is null for
every seeded row - Supabase Auth was never actually wired up. Tokens are HS256 JWTs this
backend issues and verifies itself.

The signing secret comes from ``JWT_SECRET``. In development a random secret is generated
at startup, which invalidates existing tokens on restart - acceptable locally, fatal in
production, so production refuses to start without one set explicitly.
"""
from __future__ import annotations

import logging
import os
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

import bcrypt
import httpx
import jwt
from fastapi import Depends, HTTPException, Request, status

from app.core.config import settings

logger = logging.getLogger("raipurone.security")

ALGORITHM = "HS256"
TOKEN_TTL = timedelta(hours=12)

STAFF_ROLES = frozenset({"admin", "manager", "worker"})
ADMIN_ROLES = frozenset({"admin", "manager"})


def _load_secret() -> str:
    secret = os.getenv("JWT_SECRET", "").strip()
    if secret:
        return secret
    if settings.app_env == "production":
        raise RuntimeError("JWT_SECRET must be set in production")
    generated = secrets.token_urlsafe(48)
    logger.warning(
        "JWT_SECRET is not set - generated an ephemeral development secret. "
        "Tokens will be invalidated on restart. Set JWT_SECRET in .env."
    )
    return generated


JWT_SECRET = _load_secret()


# --- Password hashing -------------------------------------------------------

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        # Seeded rows contain placeholders such as "$2b$12$CHANGE_HASH" which are not
        # valid bcrypt digests; treat them as "no password set" rather than crashing.
        return False


# --- Tokens -----------------------------------------------------------------

@dataclass(frozen=True)
class CurrentUser:
    user_id: str
    username: str
    role: str
    trust_score: float = 100.0

    @property
    def is_staff(self) -> bool:
        return self.role in STAFF_ROLES

    @property
    def is_admin(self) -> bool:
        return self.role in ADMIN_ROLES

    @property
    def display_name(self) -> str:
        return self.username


def create_access_token(user_id: str, username: str, role: str) -> dict[str, Any]:
    expires_at = datetime.now(timezone.utc) + TOKEN_TTL
    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "exp": expires_at,
        "iat": datetime.now(timezone.utc),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": role,
        "username": username,
        "expires_at": expires_at.isoformat(),
    }


def _decode(token: str) -> CurrentUser:
    try:
        claims = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Token has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc
    return CurrentUser(
        user_id=str(claims.get("sub") or ""),
        username=str(claims.get("username") or ""),
        role=str(claims.get("role") or "citizen"),
    )


def _bearer_token(request: Request) -> str | None:
    header = request.headers.get("Authorization") or ""
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


# --- FastAPI dependencies ---------------------------------------------------

def optional_user(request: Request) -> CurrentUser | None:
    """Identify the caller if a token is present; allow anonymous otherwise.

    Used on complaint intake so a citizen can still report an issue without an account,
    while a signed-in citizen gets their complaint linked to them.
    """
    token = _bearer_token(request)
    if not token:
        return None
    try:
        return _decode(token)
    except HTTPException:
        return None


def current_user(request: Request) -> CurrentUser:
    token = _bearer_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _decode(token)


def require_staff(request: Request) -> CurrentUser:
    """Admin, manager or worker only."""
    if not settings.require_auth:
        # Escape hatch for local demos; never enabled in production config.
        logger.debug("REQUIRE_AUTH is off - allowing unauthenticated staff action")
        return CurrentUser(user_id="", username="dev", role="admin")
    user = current_user(request)
    if not user.is_staff:
        raise HTTPException(status_code=403, detail="Staff role required for this action")
    return user


def require_admin(request: Request) -> CurrentUser:
    if not settings.require_auth:
        return CurrentUser(user_id="", username="dev", role="admin")
    user = current_user(request)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Administrator role required")
    return user


# --- User lookup against public.users --------------------------------------

def _users_url() -> str:
    return f"{settings.supabase_url.rstrip('/')}/rest/v1/users"


def _headers() -> dict[str, str]:
    key = settings.supabase_service_role_key or settings.supabase_anon_key
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def find_user(username: str) -> dict[str, Any] | None:
    if not settings.supabase_url:
        return None
    try:
        response = httpx.get(
            _users_url(),
            headers=_headers(),
            params={"select": "*", "username": f"eq.{username}", "limit": "1"},
            timeout=10,
        )
        response.raise_for_status()
        rows = response.json()
        return rows[0] if rows else None
    except httpx.HTTPError as exc:
        logger.warning("User lookup failed for %s: %s", username, exc)
        return None


def create_user(username: str, password: str, role: str = "citizen") -> dict[str, Any] | None:
    if not settings.supabase_url:
        return None
    payload = {
        "username": username,
        "password_hash": hash_password(password),
        "role": role,
        "trust_score": 100.0,
        "is_active": True,
    }
    response = httpx.post(
        _users_url(),
        headers={**_headers(), "Prefer": "return=representation"},
        json=payload,
        timeout=10,
    )
    if response.is_error:
        raise HTTPException(status_code=400, detail=f"Registration failed: {response.text[:200]}")
    rows = response.json()
    return rows[0] if isinstance(rows, list) else rows


StaffUser = Annotated[CurrentUser, Depends(require_staff)]
AdminUser = Annotated[CurrentUser, Depends(require_admin)]
