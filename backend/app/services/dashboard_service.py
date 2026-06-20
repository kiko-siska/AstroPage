"""Aggregates EduPage data into the home-dashboard summary."""

import logging
from datetime import date, datetime, timedelta

from edupage_api import Edupage

from app.schemas.dashboard import DashboardSummary, PeriodOut
from app.services import edupage_service
from app.services.edupage_service import EduPageDataError

logger = logging.getLogger("app.dashboard")


async def build_summary(edupage: Edupage, day: date | None = None) -> DashboardSummary:
    day = day or date.today()

    # The timetable scrape is the flakiest EduPage call (it depends on a plan
    # existing for the day and on page structure). Don't let it sink the whole
    # dashboard — degrade to an empty schedule and still show homework counts.
    try:
        periods = await edupage_service.fetch_timetable(edupage, day)
        schedule_available = True
    except EduPageDataError:
        logger.warning("dashboard: timetable unavailable for %s", day)
        periods = []
        schedule_available = False

    assignments = await edupage_service.fetch_homework(edupage)

    now = datetime.now()
    soon = now + timedelta(hours=24)
    pending = [a for a in assignments if not a.is_done]
    due_soon = [a for a in pending if a.due_date is not None and now <= a.due_date <= soon]

    return DashboardSummary(
        date=day,
        pending_homework=len(pending),
        due_within_24h=len(due_soon),
        lessons_total=len(periods),
        lessons_cancelled=sum(1 for p in periods if p.is_cancelled),
        schedule_available=schedule_available,
        schedule=[
            PeriodOut(
                period=p.period,
                start=p.start,
                end=p.end,
                subject=p.subject,
                classroom=p.classroom,
                teacher=p.teacher,
                is_cancelled=p.is_cancelled,
                curriculum=p.curriculum,
            )
            for p in periods
        ],
    )
