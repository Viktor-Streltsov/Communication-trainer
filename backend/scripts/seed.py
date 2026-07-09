"""
Seed script — populates the scenarios table with the three built-in personas.

Run from the backend/ directory after applying migrations:
    python scripts/seed.py
"""

import asyncio
import sys
from pathlib import Path

# Allow imports from backend/app even when run directly
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models.scenario import Scenario
from app.services.persona_prompts import PERSONAS


SCENARIO_META: dict[str, dict[str, str]] = {
    "interview_strict":    {"role_type": "hr",       "strictness": "high"},
    "boss_business":       {"role_type": "manager",   "strictness": "high"},
    "family_parent":       {"role_type": "parent",    "strictness": "medium"},
    "partner_conversation":{"role_type": "partner",   "strictness": "medium"},
    "friend_casual":       {"role_type": "friend",    "strictness": "low"},
}


async def seed() -> None:
    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as db:
        inserted = 0
        skipped = 0

        for code, persona in PERSONAS.items():
            existing = await db.scalar(select(Scenario).where(Scenario.code == code))
            if existing is not None:
                # Update short_description in case it was added after initial seed
                if not existing.short_description and persona.short_description:
                    existing.short_description = persona.short_description
                    print(f"  update {code!r} — refreshed short_description")
                else:
                    print(f"  skip   {code!r} — already exists")
                skipped += 1
                continue

            meta = SCENARIO_META.get(code, {"role_type": "other", "strictness": "medium"})
            db.add(
                Scenario(
                    code=code,
                    title=persona.display_name,
                    short_description=persona.short_description,
                    role_type=meta["role_type"],
                    strictness=meta["strictness"],
                    system_prompt=persona.system_prompt,
                    opening_line=persona.opening_line,
                )
            )
            print(f"  insert {code!r} — {persona.display_name}")
            inserted += 1

        await db.commit()

    await engine.dispose()
    print(f"\nDone: {inserted} inserted, {skipped} skipped.")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.run(seed(), loop_factory=asyncio.SelectorEventLoop)
    else:
        asyncio.run(seed())
