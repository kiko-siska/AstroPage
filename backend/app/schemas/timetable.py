from datetime import date

from pydantic import BaseModel

from app.schemas.dashboard import PeriodOut


class TimetableChangeOut(BaseModel):
    """A substitution affecting the student's class on a day: a cancellation,
    room/teacher swap, or class-wide calendar entry."""

    lesson: str  # period "3", span "4–5", or "" for all-day items
    change_class: str
    title: str
    action: str | None  # "add" | "change" | "remove" | None


class TimetableDayOut(BaseModel):
    """One weekday's lessons. `available` is False when EduPage couldn't return
    this day (so empty `periods` means "couldn't load", not "no lessons").
    `changes` lists substitutions for the student's class (empty when none)."""

    date: date
    available: bool
    periods: list[PeriodOut]
    changes: list[TimetableChangeOut] = []


class TimetableWeekOut(BaseModel):
    """Mon–Fri timetable for one week."""

    week_start: date  # the Monday
    week_offset: int  # 0 = current week, +1 next, -1 previous
    days: list[TimetableDayOut]
