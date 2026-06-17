"""Builds a weekly (Mon–Fri) timetable view from EduPage."""

import logging
from datetime import date, timedelta

from edupage_api import Edupage

from app.schemas.dashboard import PeriodOut
from app.schemas.timetable import TimetableDayOut, TimetableWeekOut
from app.services import edupage_service
from app.services.edupage_service import EduPageDataError, TimetablePeriod

logger = logging.getLogger("app.timetable")

WEEKDAYS = 5


def _to_periods_out(periods: list[TimetablePeriod]) -> list[PeriodOut]:
    return [
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
    ]


async def build_week(edupage: Edupage, week_offset: int = 0) -> TimetableWeekOut:
    """Mon–Fri timetable for the week `week_offset` weeks from the current one.

    Each day is fetched independently and degrades on its own: the flaky
    EduPage timetable scrape failing for one day must not blank the whole week.
    """
    today = date.today()
    monday = today - timedelta(days=today.weekday()) + timedelta(weeks=week_offset)

    days: list[TimetableDayOut] = []
    for i in range(WEEKDAYS):
        day = monday + timedelta(days=i)
        try:
            periods = await edupage_service.fetch_timetable(edupage, day)
            available = True
        except EduPageDataError as exc:
            # The underlying cause was already logged with a traceback in
            # `fetch_timetable`; record here which day was dropped from the week.
            logger.warning("timetable unavailable for %s: %s", day, exc.message)
            periods = []
            available = False
        days.append(TimetableDayOut(date=day, available=available, periods=_to_periods_out(periods)))

    return TimetableWeekOut(week_start=monday, week_offset=week_offset, days=days)
