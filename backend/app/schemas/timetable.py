from datetime import date

from pydantic import BaseModel

from app.schemas.dashboard import PeriodOut


class TimetableDayOut(BaseModel):
    """One weekday's lessons. `available` is False when EduPage couldn't return
    this day (so empty `periods` means "couldn't load", not "no lessons")."""

    date: date
    available: bool
    periods: list[PeriodOut]


class TimetableWeekOut(BaseModel):
    """Mon–Fri timetable for one week."""

    week_start: date  # the Monday
    week_offset: int  # 0 = current week, +1 next, -1 previous
    days: list[TimetableDayOut]
