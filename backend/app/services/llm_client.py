"""
Universal LLM client built on httpx.

Uses the OpenAI Chat Completions format:
  POST {LLM_API_BASE_URL}/chat/completions
  Authorization: Bearer {LLM_API_KEY}
  Body: { model, messages, temperature }

Groq, OpenAI, OpenRouter, and most other providers speak this format natively,
so switching provider requires only .env changes — no code changes.
"""

from __future__ import annotations

import httpx

from app.config import settings

type Message = dict[str, str]  # {"role": "system"|"user"|"assistant", "content": "..."}


class LLMClient:
    """Thin async wrapper around any OpenAI-compatible chat-completion API."""

    def __init__(self) -> None:
        self._model = settings.llm_model
        self._api_key = settings.llm_api_key
        self._url = settings.llm_api_base_url.rstrip("/") + "/chat/completions"

    async def chat(self, messages: list[Message]) -> str:
        """Send a conversation history and return the assistant's reply."""
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self._model,
            "messages": messages,
            "temperature": 0.7,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(self._url, headers=headers, json=payload)
            response.raise_for_status()

        return response.json()["choices"][0]["message"]["content"]


# Module-level singleton — import and use directly in routers/services.
llm_client = LLMClient()
