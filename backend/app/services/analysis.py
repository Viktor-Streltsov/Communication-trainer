"""
Communication coach analysis service.

This module is intentionally separate from persona_prompts.py: the coach
is a *different* LLM role — it never participates in the dialogue itself,
it only reviews the finished conversation and gives structured feedback.
"""

from __future__ import annotations

import json
import re

from app.models.message import Message
from app.services.llm_client import llm_client

# ---------------------------------------------------------------------------
# Coach system prompt
# ---------------------------------------------------------------------------

COACH_SYSTEM_PROMPT = """\
Ты — опытный коммуникационный коуч. Твоя задача — разобрать завершённый \
диалог и дать структурированную обратную связь пользователю (отмечен как \
"Пользователь" в диалоге).

Анализируй только реплики пользователя — не персонажа, с которым он разговаривал.

Отвечай ТОЛЬКО валидным JSON-объектом, без каких-либо пояснений вне JSON:
{
  "success_score": <целое число от 0 до 100>,
  "overall_impression": "<один абзац — общее впечатление от того, как пользователь \
вёл разговор: уверенность, ясность мысли, умение держать нить>",
  "strengths": ["<что пользователь делал хорошо>", ...],
  "weak_points": [
    {"phrase": "<дословная цитата проблемной реплики>", "problem": "<в чём проблема>"},
    ...
  ],
  "suggested_phrasings": [
    {"original": "<проблемная фраза>", "improved": "<как лучше сказать>"},
    ...
  ],
  "motivational_message": "<тёплое, личное напутствие от коуча — 1-2 предложения \
без клише, конкретное и поддерживающее>"
}

Правила оценки success_score:
- 0–40: пользователь часто говорил расплывчато, не мог сформулировать мысль, \
уходил от темы или давал пустые ответы
- 41–70: были отдельные чёткие моменты, но и заметные пробелы в формулировках
- 71–100: пользователь в целом говорил ясно, конкретно и по делу

Если диалог слишком короткий (менее двух реплик пользователя) — поставь \
success_score 0, во все списки помести по одному элементу с пояснением, \
что диалог слишком короткий.
"""

# ---------------------------------------------------------------------------
# Analysis result
# ---------------------------------------------------------------------------

class AnalysisResult:
    __slots__ = (
        "success_score",
        "overall_impression",
        "strengths",
        "weak_points",
        "suggested_phrasings",
        "motivational_message",
        "summary_text",
    )

    def __init__(
        self,
        success_score: int,
        overall_impression: str,
        strengths: list,
        weak_points: list,
        suggested_phrasings: list,
        motivational_message: str,
        summary_text: str,
    ) -> None:
        self.success_score = success_score
        self.overall_impression = overall_impression
        self.strengths = strengths
        self.weak_points = weak_points
        self.suggested_phrasings = suggested_phrasings
        self.motivational_message = motivational_message
        self.summary_text = summary_text


# ---------------------------------------------------------------------------
# Public function
# ---------------------------------------------------------------------------

async def analyse_session(messages: list[Message]) -> AnalysisResult:
    """
    Call the LLM coach with the full session transcript and return
    a parsed AnalysisResult.
    """
    lines: list[str] = []
    for msg in messages:
        label = "Пользователь" if msg.sender == "user" else "Персонаж"
        lines.append(f"{label}: {msg.text}")

    transcript = "\n\n".join(lines) if lines else "(диалог пуст)"

    llm_messages = [
        {"role": "system", "content": COACH_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                "Вот полный диалог для анализа:\n\n"
                f"{transcript}\n\n"
                "Дай структурированный разбор в формате JSON, описанном в инструкции."
            ),
        },
    ]

    raw = await llm_client.chat(llm_messages)
    parsed = _parse_coach_response(raw)

    success_score = int(parsed.get("success_score") or 0)
    success_score = max(0, min(100, success_score))

    overall_impression = parsed.get("overall_impression") or ""
    motivational_message = parsed.get("motivational_message") or ""
    strengths = parsed.get("strengths") or []
    weak_points = parsed.get("weak_points") or []
    suggested_phrasings = parsed.get("suggested_phrasings") or []

    summary_text = _build_summary(parsed)

    return AnalysisResult(
        success_score=success_score,
        overall_impression=overall_impression,
        strengths=strengths,
        weak_points=weak_points,
        suggested_phrasings=suggested_phrasings,
        motivational_message=motivational_message,
        summary_text=summary_text,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_coach_response(raw: str) -> dict:
    """Extract and parse the JSON block from the LLM response."""
    cleaned = re.sub(r"```(?:json)?", "", raw).strip().strip("`").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        return {
            "success_score": 0,
            "overall_impression": "",
            "strengths": [],
            "weak_points": [],
            "suggested_phrasings": [],
            "motivational_message": "",
        }


def _build_summary(data: dict) -> str:
    """Plain-text summary stored in DB for quick lookup."""
    parts: list[str] = []

    score = data.get("success_score")
    if score is not None:
        parts.append(f"Оценка: {score}/100")

    impression = data.get("overall_impression", "")
    if impression:
        parts.append(impression)

    strengths = data.get("strengths", [])
    if strengths:
        parts.append("Сильные стороны:\n" + "\n".join(f"• {s}" for s in strengths))

    weak_points = data.get("weak_points", [])
    if weak_points:
        items = []
        for wp in weak_points:
            if isinstance(wp, dict):
                phrase = wp.get("phrase", "")
                problem = wp.get("problem", "")
                items.append(f'• "{phrase}" — {problem}' if phrase else f"• {problem}")
            else:
                items.append(f"• {wp}")
        parts.append("Слабые места:\n" + "\n".join(items))

    suggested = data.get("suggested_phrasings", [])
    if suggested:
        items = []
        for sp in suggested:
            if isinstance(sp, dict):
                orig = sp.get("original", "")
                improved = sp.get("improved", "")
                items.append(f'• Вместо "{orig}" → "{improved}"' if orig else f"• {improved}")
            else:
                items.append(f"• {sp}")
        parts.append("Как лучше сказать:\n" + "\n".join(items))

    return "\n\n".join(parts) if parts else "Анализ не содержит данных."
