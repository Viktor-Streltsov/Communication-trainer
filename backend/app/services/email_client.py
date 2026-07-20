"""Thin wrapper around the Resend API for sending transactional emails.

Resend offers a free tier (100 emails/day) with no credit card required.
Sign up at https://resend.com and create an API key, then set RESEND_API_KEY in .env.

If RESEND_API_KEY is empty (e.g. local development without email) the send is
skipped and the code is printed to the console instead so you can still test
the auth flow without a real email account.
"""

from __future__ import annotations

import logging

import resend

from app.config import settings

logger = logging.getLogger(__name__)


def send_verification_code(to_email: str, code: str) -> None:
    """Send a 6-digit verification code to *to_email* via Resend.

    Raises RuntimeError if the Resend API returns an error.
    Falls back to console logging when RESEND_API_KEY is not configured.
    """
    if not settings.resend_api_key:
        logger.warning(
            "RESEND_API_KEY is not set — skipping email delivery. "
            "Verification code for %s: %s",
            to_email,
            code,
        )
        return

    resend.api_key = settings.resend_api_key

    html_body = f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">Your login code</h2>
      <p>Use the code below to sign in to Communication Trainer.
         It expires in <strong>10 minutes</strong>.</p>
      <div style="
        font-size: 2.5rem;
        font-weight: 700;
        letter-spacing: 0.25em;
        text-align: center;
        padding: 24px;
        background: #f4f4f8;
        border-radius: 8px;
        margin: 24px 0;
      ">
        {code}
      </div>
      <p style="color: #888; font-size: 0.85rem;">
        If you did not request this code, you can safely ignore this email.
      </p>
    </div>
    """

    params: resend.Emails.SendParams = {
        "from": settings.resend_from_email,
        "to": [to_email],
        "subject": f"{code} — your Communication Trainer login code",
        "html": html_body,
    }

    response = resend.Emails.send(params)

    if not response.get("id"):
        raise RuntimeError(f"Resend API returned unexpected response: {response}")
