"""AI homework draft generation using Google Gemini.

Accepts the assignment text and optional attachment bytes (PDFs, images) as
context and returns a markdown draft for student review. Falls back to an
offline template when no GEMINI_API_KEY is configured.
"""

import logging

from google import genai
from google.genai import types

from app.core.config import settings

logger = logging.getLogger("app.ai")

MODEL = "gemini-2.5-flash"
MAX_OUTPUT_TOKENS = 8192
# Inline data limit for Gemini; files larger than this are skipped.
_MAX_FILE_BYTES = 20 * 1024 * 1024  # 20 MB
_MAX_ASSIGNMENT_CHARS = 50_000

# Core product constraint (see CLAUDE.md): draft and explain, never just a
# final answer. Always appended; the user's custom prompt cannot remove it.
STUDY_ASSISTANT_CONSTRAINT = (
    "You are a study assistant for a secondary-school student. Draft a solution "
    "to the assignment AND explain the reasoning step by step so the student can "
    "learn from it — never produce only a bare final answer. Write the draft in "
    "markdown. End with a short checklist reminding the student to verify the "
    "work and rewrite it in their own words before submitting anything. The "
    "student must always review and own the final submission."
)

# MIME types Gemini can process inline; anything else is skipped.
_SUPPORTED_MIME_PREFIXES = ("image/", "application/pdf", "text/")


class AiUnavailableError(Exception):
    """Raised when the AI provider rejects or fails the request."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def build_system_prompt(custom_prompt: str | None) -> str:
    """The student's custom rules go first; the study-assistant constraint is
    always appended so it cannot be overridden away."""
    parts: list[str] = []
    if custom_prompt and custom_prompt.strip():
        parts.append(custom_prompt.strip())
    parts.append(STUDY_ASSISTANT_CONSTRAINT)
    return "\n\n".join(parts)


def _build_user_message(subject: str | None, title: str, description: str) -> str:
    body = description.strip()[:_MAX_ASSIGNMENT_CHARS]
    return (
        f"Subject: {subject or 'unknown'}\n"
        f"Assignment title: {title}\n\n"
        f"Assignment instructions:\n{body}\n\n"
        "Draft a solution I can review and edit."
    )


def _fallback_draft(subject: str | None, title: str, description: str) -> str:
    """Deterministic offline draft so the flow works without an API key."""
    return (
        f"# {title} — Draft\n\n"
        "> AI generation is not configured on this server (no `GEMINI_API_KEY`), "
        "so this is a structured starting template.\n\n"
        "## Understanding the task\n"
        f"{description.strip()[:2000]}\n\n"
        "## Draft solution\n"
        "1. Restate what the task is asking in your own words.\n"
        "2. Work through the core steps one by one.\n"
        "3. Check the result against the instructions above.\n\n"
        "## Before you submit\n"
        "- [ ] Verified the facts and numbers\n"
        "- [ ] Rewritten in your own words\n"
    )


async def generate_draft(
    subject: str | None,
    title: str,
    description: str,
    custom_prompt: str | None,
    attachments: list[tuple[bytes, str]] | None = None,
) -> str:
    """Generate a markdown homework draft.

    attachments: list of (file_bytes, mime_type) pairs included as context.
    Files exceeding 20 MB or with unsupported MIME types are silently skipped.
    Raises AiUnavailableError on provider failure.
    """
    if not settings.gemini_api_key:
        logger.info("ai draft: no GEMINI_API_KEY configured, returning fallback template")
        return _fallback_draft(subject, title, description)

    client = genai.Client(api_key=settings.gemini_api_key)

    # Attachment parts first so the model sees the files before the question.
    parts: list[types.Part] = []
    for file_bytes, mime_type in attachments or []:
        if len(file_bytes) > _MAX_FILE_BYTES:
            logger.debug("ai draft: skipping attachment >20 MB mime=%s", mime_type)
            continue
        if not any(mime_type.startswith(p) for p in _SUPPORTED_MIME_PREFIXES):
            logger.debug("ai draft: skipping unsupported mime=%s", mime_type)
            continue
        parts.append(types.Part.from_bytes(data=file_bytes, mime_type=mime_type))

    parts.append(types.Part.from_text(text=_build_user_message(subject, title, description)))

    config = types.GenerateContentConfig(
        system_instruction=build_system_prompt(custom_prompt),
        max_output_tokens=MAX_OUTPUT_TOKENS,
    )

    try:
        response = await client.aio.models.generate_content(
            model=MODEL,
            contents=parts,
            config=config,
        )
    except Exception as exc:
        logger.warning("gemini API error: %s %s", type(exc).__name__, str(exc)[:200])
        raise AiUnavailableError("The AI assistant is unavailable right now. Try again later.")

    draft = (response.text or "").strip()
    if not draft:
        raise AiUnavailableError("The AI assistant returned an empty draft. Try again.")
    return draft
