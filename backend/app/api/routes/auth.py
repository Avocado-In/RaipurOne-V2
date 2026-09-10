"""Login and registration against ``public.users``.

Replaces the previous stub, which returned ``demo-token-<username>`` to anyone who asked
and validated nothing anywhere.
"""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.security import (
    CurrentUser,
    create_access_token,
    create_user,
    current_user,
    find_user,
    verify_password,
)

logger = logging.getLogger("raipurone.auth")
router = APIRouter()


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=1, max_length=256)


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=256)
    # Role is deliberately NOT accepted from the request body: letting a caller choose
    # their own role would let anyone register themselves as an administrator.


@router.post("/login")
def login(payload: LoginRequest):
    user = find_user(payload.username)
    if not user or not user.get("is_active", True):
        # Same message for unknown user and wrong password, so the endpoint cannot be
        # used to enumerate valid usernames.
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not verify_password(payload.password, user.get("password_hash")):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    return create_access_token(
        user_id=str(user.get("id")),
        username=str(user.get("username")),
        role=str(user.get("role") or "citizen"),
    )


@router.post("/register")
def register(payload: RegisterRequest):
    if find_user(payload.username):
        raise HTTPException(status_code=409, detail="That username is already taken")

    created = create_user(payload.username, payload.password, role="citizen")
    if not created:
        raise HTTPException(status_code=503, detail="User storage is not configured")

    return create_access_token(
        user_id=str(created.get("id")),
        username=str(created.get("username")),
        role=str(created.get("role") or "citizen"),
    )


@router.get("/me")
def read_current_user(user: Annotated[CurrentUser, Depends(current_user)]):
    return {
        "user_id": user.user_id,
        "username": user.username,
        "role": user.role,
        "is_staff": user.is_staff,
        "is_admin": user.is_admin,
    }
