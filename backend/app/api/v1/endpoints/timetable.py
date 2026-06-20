from typing import Annotated

from edupage_api import Edupage
from fastapi import APIRouter, Depends, Query

from app.api.deps import get_edupage_client
from app.schemas.timetable import TimetableWeekOut
from app.services import timetable_service

router = APIRouter(prefix="/timetable", tags=["timetable"])


@router.get("/week", response_model=TimetableWeekOut)
async def week(
    edupage: Annotated[Edupage, Depends(get_edupage_client)],
    offset: Annotated[int, Query(ge=-8, le=8)] = 0,
) -> TimetableWeekOut:
    """Mon–Fri timetable for the week `offset` weeks from the current one.

    Per-day failures degrade individually (see `build_week`); the endpoint
    itself doesn't 502 just because one day's scrape failed.
    """
    return await timetable_service.build_week(edupage, offset)
