from typing import Annotated

from edupage_api import Edupage
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_auth_context, get_edupage_client
from app.db.session import get_session
from app.schemas.homework import (
    DraftResponse,
    GenerateAiRequest,
    HomeworkAttachment,
    HomeworkItem,
    MarkDoneRequest,
    MarkDoneResponse,
)
from app.services import homework_service
from app.services.ai_service import AiUnavailableError
from app.services.edupage_service import EduPageDataError

router = APIRouter(prefix="/homework", tags=["homework"])


@router.get("/list", response_model=list[HomeworkItem])
async def list_homework(
    edupage: Annotated[Edupage, Depends(get_edupage_client)],
) -> list[HomeworkItem]:
    """All homework assignments from the student's EduPage timeline."""
    try:
        assignments = await homework_service.list_assignments(edupage)
    except EduPageDataError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=exc.message)
    return [
        HomeworkItem(
            id=a.id,
            subject=a.subject,
            title=a.title,
            description=a.description,
            teacher=a.teacher,
            assigned_at=a.assigned_at,
            due_date=a.due_date,
            is_done=a.is_done,
            has_attachments=a.has_attachments,
        )
        for a in assignments
    ]


@router.get("/{assignment_id}/attachments", response_model=list[HomeworkAttachment])
async def list_attachments(
    assignment_id: str,
    edupage: Annotated[Edupage, Depends(get_edupage_client)],
) -> list[HomeworkAttachment]:
    """Files attached to an assignment's linked e-test (empty when none)."""
    try:
        attachments = await homework_service.list_attachments(edupage, assignment_id)
    except EduPageDataError as exc:
        code = (
            status.HTTP_404_NOT_FOUND if exc.reason == "not_found" else status.HTTP_502_BAD_GATEWAY
        )
        raise HTTPException(status_code=code, detail=exc.message)
    return [
        HomeworkAttachment(name=a.name, url=a.url, type=a.type, extension=a.extension)
        for a in attachments
    ]


@router.post("/{assignment_id}/done", response_model=MarkDoneResponse)
async def mark_done(
    assignment_id: str,
    payload: MarkDoneRequest,
    edupage: Annotated[Edupage, Depends(get_edupage_client)],
) -> MarkDoneResponse:
    """Mark an assignment done / not done on EduPage (student-initiated)."""
    try:
        await homework_service.set_done(edupage, assignment_id, payload.done)
    except EduPageDataError as exc:
        code = (
            status.HTTP_404_NOT_FOUND if exc.reason == "not_found" else status.HTTP_502_BAD_GATEWAY
        )
        raise HTTPException(status_code=code, detail=exc.message)
    return MarkDoneResponse(assignment_id=assignment_id, is_done=payload.done)


@router.post("/generate-ai", response_model=DraftResponse)
async def generate_ai(
    payload: GenerateAiRequest,
    ctx: Annotated[AuthContext, Depends(get_auth_context)],
    edupage: Annotated[Edupage, Depends(get_edupage_client)],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> DraftResponse:
    """Draft the assignment with the AI assistant and cache the result.

    The response is always a draft for the student to review and edit —
    nothing is submitted to EduPage.
    """
    try:
        draft, cached = await homework_service.generate_draft(
            db, ctx.user, edupage, payload.assignment_id, force=payload.force
        )
    except EduPageDataError as exc:
        code = (
            status.HTTP_404_NOT_FOUND if exc.reason == "not_found" else status.HTTP_502_BAD_GATEWAY
        )
        raise HTTPException(status_code=code, detail=exc.message)
    except AiUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=exc.message)

    return DraftResponse(
        assignment_id=draft.assignment_id,
        draft=draft.ai_response,
        cached=cached,
        created_at=draft.created_at,
    )
