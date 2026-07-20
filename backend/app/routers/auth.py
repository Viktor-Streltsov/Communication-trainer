"""Authentication via email one-time codes.

Flow:
  1. POST /auth/request-code  — generate & email a 6-digit code (TTL 10 min).
  2. POST /auth/verify-code   — exchange code for a JWT; user is created on first login.

Anonymous usage of the rest of the API is intentionally preserved — auth is optional.
"""

from __future__ import annotations

import logging
import random
import string
from datetime import datetime, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.models.user import User
from app.models.verification_code import VerificationCode
from app.services.email_client import send_verification_code

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

_RATE_LIMIT_SECONDS = 60


# ------------------------------------------------------------------
# Schemas
# ------------------------------------------------------------------


class RequestCodeBody(BaseModel):
    email: EmailStr


class RequestCodeResponse(BaseModel):
    detail: str


class VerifyCodeBody(BaseModel):
    email: EmailStr
    code: str


class VerifyCodeResponse(BaseModel):
    access_token: str
    user_id: str


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------


def _generate_code() -> str:
    return "".join(random.choices(string.digits, k=6))


def _make_jwt(user_id: str) -> str:
    payload = {"sub": user_id}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------


@router.post("/request-code", response_model=RequestCodeResponse)
async def request_code(
    body: RequestCodeBody,
    db: AsyncSession = Depends(get_db),
) -> RequestCodeResponse:
    """Generate a 6-digit code and email it to the user.

    Rate-limited to one request per email per 60 seconds (checked against
    the most recent unused, unexpired code for that address).
    """
    now = datetime.now(timezone.utc)

    # Rate-limit: find the newest unused code for this email
    result = await db.execute(
        select(VerificationCode)
        .where(
            VerificationCode.email == body.email,
            VerificationCode.used.is_(False),
            VerificationCode.expires_at > now,
        )
        .order_by(VerificationCode.created_at.desc())
        .limit(1)
    )
    recent = result.scalar_one_or_none()
    if recent is not None:
        elapsed = (now - recent.created_at.replace(tzinfo=timezone.utc)).total_seconds()
        if elapsed < _RATE_LIMIT_SECONDS:
            wait = int(_RATE_LIMIT_SECONDS - elapsed)
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {wait} seconds before requesting a new code.",
            )

    code = _generate_code()
    db.add(VerificationCode.create(email=body.email, code=code))
    await db.commit()

    try:
        send_verification_code(to_email=body.email, code=code)
    except Exception as exc:
        logger.error("Failed to send verification email to %s: %s", body.email, exc)
        raise HTTPException(status_code=502, detail="Failed to send verification email.") from exc

    return RequestCodeResponse(detail="Verification code sent. Check your inbox.")


@router.post("/verify-code", response_model=VerifyCodeResponse)
async def verify_code(
    body: VerifyCodeBody,
    db: AsyncSession = Depends(get_db),
) -> VerifyCodeResponse:
    """Exchange a valid code for a JWT access token.

    Finds or creates the User record for the given email, marks the
    verification code as used, and returns {access_token, user_id}.
    """
    now = datetime.now(timezone.utc)

    # Find the newest matching, unused, non-expired code
    result = await db.execute(
        select(VerificationCode)
        .where(
            VerificationCode.email == body.email,
            VerificationCode.code == body.code,
            VerificationCode.used.is_(False),
            VerificationCode.expires_at > now,
        )
        .order_by(VerificationCode.created_at.desc())
        .limit(1)
    )
    vc = result.scalar_one_or_none()
    if vc is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired verification code.",
        )

    # Find or create the user
    user_result = await db.execute(select(User).where(User.email == body.email))
    user = user_result.scalar_one_or_none()
    if user is None:
        user = User(email=body.email)
        db.add(user)
        await db.flush()

    vc.used = True
    await db.commit()

    token = _make_jwt(str(user.id))
    return VerifyCodeResponse(access_token=token, user_id=str(user.id))
