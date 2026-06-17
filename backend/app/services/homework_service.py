"""Homework listing and AI draft orchestration."""

import logging
from datetime import date

from edupage_api import Edupage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.homework_draft import HomeworkDraft
from app.models.user import User
from app.services import ai_service, edupage_service
from app.services.edupage_service import EduPageDataError, HomeworkAssignment, HomeworkAttachment

logger = logging.getLogger("app.homework")


def _school_year_start(today: date | None = None) -> date:
    """August 1st of the current academic year — the window we fetch homework
    over so the list (and every id-resolver below) sees the whole year, not
    just EduPage's last-couple-of-weeks notification cache."""
    today = today or date.today()
    year = today.year if today.month >= 8 else today.year - 1
    return date(year, 8, 1)


async def _fetch_assignments(edupage: Edupage) -> list[HomeworkAssignment]:
    return await edupage_service.fetch_homework(edupage, since=_school_year_start())


async def list_assignments(edupage: Edupage) -> list[HomeworkAssignment]:
    return await _fetch_assignments(edupage)


async def list_attachments(edupage: Edupage, assignment_id: str) -> list[HomeworkAttachment]:
    """Attachments for one assignment, resolved by id from the student's own
    timeline so a client-supplied `superid` is never trusted."""
    assignments = await _fetch_assignments(edupage)
    assignment = next((a for a in assignments if a.id == assignment_id), None)
    if assignment is None:
        raise EduPageDataError("not_found", "That assignment was not found on EduPage.")
    if not assignment.superid:
        return []
    return await edupage_service.fetch_homework_attachments(edupage, assignment.superid)


async def set_done(edupage: Edupage, assignment_id: str, done: bool) -> None:
    """Mark an assignment done / not done. Resolves the assignment from the
    student's own timeline first (so a stale or forged id can't be toggled) and
    uses its `superid` — the form EduPage's homeworkFlag action requires."""
    assignments = await _fetch_assignments(edupage)
    assignment = next((a for a in assignments if a.id == assignment_id), None)
    if assignment is None:
        raise EduPageDataError("not_found", "That assignment was not found on EduPage.")
    if not assignment.superid:
        raise EduPageDataError("not_found", "This assignment can't be marked done on EduPage.")
    await edupage_service.set_homework_done(edupage, assignment.superid, assignment.id, done)


async def get_cached_draft(
    db: AsyncSession, user: User, assignment_id: str
) -> HomeworkDraft | None:
    result = await db.execute(
        select(HomeworkDraft).where(
            HomeworkDraft.user_id == user.id,
            HomeworkDraft.assignment_id == assignment_id,
        )
    )
    return result.scalar_one_or_none()


async def generate_draft(
    db: AsyncSession,
    user: User,
    edupage: Edupage,
    assignment_id: str,
    force: bool = False,
) -> tuple[HomeworkDraft, bool]:
    """Return (draft, cached). Generates and caches when missing or `force`."""
    if not force:
        cached = await get_cached_draft(db, user, assignment_id)
        if cached is not None:
            return cached, True

    assignments = await _fetch_assignments(edupage)
    assignment = next((a for a in assignments if a.id == assignment_id), None)
    if assignment is None:
        raise EduPageDataError("not_found", "That assignment was not found on EduPage.")

    # Download attachment files best-effort; skip any that fail or are absent.
    file_parts: list[tuple[bytes, str]] = []
    if assignment.has_attachments and assignment.superid:
        try:
            raw_attachments = await edupage_service.fetch_homework_attachments(
                edupage, assignment.superid
            )
            for att in raw_attachments[:5]:  # cap to avoid oversized payloads
                try:
                    data, mime = await edupage_service.download_attachment(edupage, att.url)
                    file_parts.append((data, mime))
                except EduPageDataError:
                    pass
        except EduPageDataError:
            pass

    markdown = await ai_service.generate_draft(
        subject=assignment.subject,
        title=assignment.title,
        description=assignment.description,
        custom_prompt=user.custom_ai_prompt,
        attachments=file_parts,
    )

    draft = await get_cached_draft(db, user, assignment_id)
    if draft is None:
        draft = HomeworkDraft(
            user_id=user.id,
            assignment_id=assignment_id,
            original_text=assignment.description,
            ai_response=markdown,
        )
    else:
        draft.original_text = assignment.description
        draft.ai_response = markdown
    db.add(draft)
    await db.commit()
    await db.refresh(draft)
    logger.info("ai draft cached: user=%s assignment=%s", user.username, assignment_id)
    return draft, False
