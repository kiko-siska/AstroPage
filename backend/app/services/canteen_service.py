"""Canteen menus and meal ordering."""

from datetime import date, timedelta

from edupage_api import Edupage

from app.schemas.canteen import MealDayOut, MenuOptionOut
from app.services import edupage_service
from app.services.edupage_service import EduPageDataError

MAX_WEEKS = 4


def upcoming_weekdays(start: date, weeks: int) -> list[date]:
    """Mon–Fri dates from the Monday of `start`'s week, for `weeks` weeks."""
    monday = start - timedelta(days=start.weekday())
    return [monday + timedelta(weeks=w, days=d) for w in range(weeks) for d in range(5)]


def next_school_days(start: date, count: int) -> list[date]:
    """The next `count` school days (Mon–Fri) on or after `start`, skipping weekends.

    The canteen is closed on weekends, so ordering for a Saturday/Sunday just
    errors — we never include them. `count` is therefore counted in school days,
    not calendar days, so a request for 5 yields a full school week.
    """
    days: list[date] = []
    day = start
    while len(days) < count:
        if day.weekday() < 5:  # 0=Mon .. 4=Fri
            days.append(day)
        day += timedelta(days=1)
    return days


async def list_meals(edupage: Edupage, weeks: int) -> list[MealDayOut]:
    days = upcoming_weekdays(date.today(), min(max(weeks, 1), MAX_WEEKS))
    meal_days = await edupage_service.fetch_meals(edupage, days)
    return [
        MealDayOut(
            date=m.date,
            open=m.open,
            title=m.title,
            options=[
                MenuOptionOut(letter=o.letter, name=o.name, allergens=o.allergens, weight=o.weight)
                for o in m.options
            ],
            ordered_meal=m.ordered_meal,
            can_be_changed_until=m.can_be_changed_until,
        )
        for m in meal_days
    ]


async def order(edupage: Edupage, day: date, choice: str | None) -> str | None:
    return await edupage_service.order_meal(edupage, day, choice)


async def bulk_signup(edupage: Edupage, days_count: int, preferred_choice: str) -> tuple[int, int]:
    """Order `preferred_choice` on the next `days_count` school days.

    Starts from tomorrow and counts only Mon–Fri (weekends are skipped outright —
    the canteen is closed then and ordering would error). A day within that span
    is still skipped (not an error) when the kitchen is closed for a holiday, the
    student is already signed up, the preferred menu isn't offered, or EduPage
    rejects the change (e.g. past the cut-off). Returns
    ``(updated_days, skipped_days)``.

    Each EduPage round trip is sequential by design: the underlying
    ``requests.Session`` is not thread-safe, so concurrent orders would race.
    """
    start = date.today() + timedelta(days=1)
    days = next_school_days(start, days_count)
    meal_days = await edupage_service.fetch_meals(edupage, days)

    # Pick the days worth attempting: open, not already ordered, offering the
    # preferred menu.
    candidates: list[date] = []
    skipped = 0
    for meal_day in meal_days:
        already_ordered = meal_day.ordered_meal is not None
        offers_choice = any(o.letter == preferred_choice for o in meal_day.options)
        if not meal_day.open or already_ordered or not offers_choice:
            skipped += 1
            continue
        candidates.append(meal_day.date)

    if not candidates:
        return 0, skipped

    # Fire each order without an immediate per-day re-read — EduPage is slow to
    # reflect a just-placed order, which makes tight-loop verification flaky.
    for day in candidates:
        try:
            await edupage_service.order_meal(edupage, day, preferred_choice, verify=False)
        except EduPageDataError:
            # Don't trust this either way — the single fresh fetch below is the
            # source of truth for what actually landed.
            pass

    # Confirm once, against a fresh fetch, what actually persisted on EduPage.
    confirmed = await edupage_service.fetch_meals(edupage, candidates)
    ordered_by_date = {m.date: m.ordered_meal for m in confirmed}
    updated = sum(1 for d in candidates if ordered_by_date.get(d) == preferred_choice)
    skipped += len(candidates) - updated
    return updated, skipped
