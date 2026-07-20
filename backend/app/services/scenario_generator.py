"""Generate a custom dialogue scenario from a user's free-text description.

The LLM is prompted as a "scenario designer": given a one-sentence situation
description it produces a structured JSON with all fields required to persist
a new Scenario row and run a chat session against it.

The generated persona style deliberately mirrors the five built-in scenarios:
  - display_name  → poetic scene-of-the-moment title, no spoilers
  - short_description → neutral context only, no character traits
  - system_prompt → full persona definition in Russian, same structure as built-ins
  - opening_line  → persona's first message
  - role_type     → single lowercase word (e.g. "ex_partner", "landlord")
"""

from __future__ import annotations

import json
import re

from app.services.llm_client import llm_client

SYSTEM_PROMPT = """\
Ты — дизайнер учебных диалоговых сценариев для тренажёра общения.

Твоя задача: получить от пользователя краткое описание реальной жизненной ситуации
и сформировать JSON-объект с полями для нового персонажа/сценария.

Строгие правила:
1. display_name — короткая поэтическая сцена момента (3–6 слов), описывает обстановку
   или момент времени, НЕ характер персонажа и НЕ исход. Примеры стиля:
   «В переговорной, 15:00», «После работы, на кухне», «Созвон на бегу».
2. short_description — нейтральный контекст ситуации (1–2 предложения), только факты,
   без оценок и без описания характера персонажа.
3. system_prompt — полное описание персонажа (на русском). Включи:
   - кто этот человек и какова его роль в ситуации
   - его эмоциональный фон и стиль общения
   - как он реагирует, если пользователь говорит расплывчато, уходит от темы
     или не может сформулировать мысль (конкретные фразы-реакции)
   - финальная инструкция: «Отвечай только от лица своего персонажа, никогда не выходи из роли.»
   Объём — как у профессионального сценарного описания, не короче 200 слов.
4. opening_line — первая реплика персонажа (1–3 предложения), естественная, в роли.
5. role_type — одно слово латиницей, snake_case, описывает тип роли (например:
   ex_partner, landlord, colleague, doctor, teacher, neighbor, client).
   Не используй уже существующие: hr, manager, parent, partner, friend.

Верни ТОЛЬКО валидный JSON без дополнительных комментариев:
{
  "display_name": "...",
  "short_description": "...",
  "system_prompt": "...",
  "opening_line": "...",
  "role_type": "..."
}
"""


class ScenarioGeneratorError(Exception):
    """Raised when the LLM returns an unparseable or incomplete response."""


async def generate_scenario(description: str) -> dict[str, str]:
    """Ask the LLM to generate a scenario from a user description.

    Returns a dict with keys:
        display_name, short_description, system_prompt, opening_line, role_type

    Raises ScenarioGeneratorError on parse failure.
    """
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": description.strip()},
    ]

    raw = await llm_client.chat(messages)

    # Strip markdown code fences if the model wrapped the JSON
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.DOTALL).strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ScenarioGeneratorError(
            f"LLM returned non-JSON response: {raw[:200]!r}"
        ) from exc

    required = {"display_name", "short_description", "system_prompt", "opening_line", "role_type"}
    missing = required - data.keys()
    if missing:
        raise ScenarioGeneratorError(f"LLM response missing fields: {missing}")

    # Sanitise: ensure all values are non-empty strings
    for field in required:
        if not isinstance(data[field], str) or not data[field].strip():
            raise ScenarioGeneratorError(f"LLM returned empty value for field '{field}'")

    return {k: str(data[k]).strip() for k in required}
