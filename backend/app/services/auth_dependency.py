"""FastAPI dependency for optional JWT authentication.

Usage in a route:
    current_user: User | None = Depends(get_current_user_optional)

Returns the User if a valid Bearer token is present in the Authorization header,
or None if the header is absent, malformed, or the token is invalid/expired.
Anonymous access is intentionally preserved — callers must handle the None case.
"""

from __future__ import annotations

import logging

import jwt
from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.models.user import User

logger = logging.getLogger(__name__)


async def get_current_user_optional(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Return the authenticated User or None (never raises for auth failures)."""
    if not authorization:
        return None

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None

    token = parts[1]
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.PyJWTError:
        return None

    user_id: str | None = payload.get("sub")
    if not user_id:
        return None

    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
