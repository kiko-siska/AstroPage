"""ai_service: system prompt composition and offline fallback."""

from app.core.config import settings
from app.services import ai_service


def test_system_prompt_always_contains_constraint():
    prompt = ai_service.build_system_prompt(None)
    assert ai_service.STUDY_ASSISTANT_CONSTRAINT in prompt


def test_custom_prompt_prepended_but_constraint_kept():
    prompt = ai_service.build_system_prompt("Always answer in Slovak.")
    assert prompt.startswith("Always answer in Slovak.")
    assert ai_service.STUDY_ASSISTANT_CONSTRAINT in prompt


def test_blank_custom_prompt_ignored():
    assert ai_service.build_system_prompt("   ") == ai_service.STUDY_ASSISTANT_CONSTRAINT


async def test_fallback_draft_without_api_key(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")
    draft = await ai_service.generate_draft("Math", "Worksheet", "Solve 4–12.", None)
    assert draft.startswith("# Worksheet — Draft")
    assert "Solve 4–12." in draft


def test_user_message_truncates_huge_assignments():
    msg = ai_service._build_user_message("Math", "T", "x" * 200_000)
    assert len(msg) < ai_service._MAX_ASSIGNMENT_CHARS + 500
