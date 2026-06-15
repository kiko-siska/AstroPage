"""canteen_service: weekday window computation + bulk sign-up engine."""

from datetime import date, timedelta

from app.services import edupage_service
from app.services.canteen_service import bulk_signup, upcoming_weekdays
from app.services.edupage_service import EduPageDataError, MealDay, MealMenu


def test_two_weeks_of_weekdays_from_monday():
    days = upcoming_weekdays(date(2026, 6, 10), weeks=2)  # a Wednesday
    assert len(days) == 10
    assert days[0] == date(2026, 6, 8)  # Monday of that week
    assert days[4] == date(2026, 6, 12)  # Friday
    assert days[5] == date(2026, 6, 15)  # next Monday
    assert all(d.weekday() < 5 for d in days)


def test_start_on_monday_is_stable():
    days = upcoming_weekdays(date(2026, 6, 8), weeks=1)
    assert days[0] == date(2026, 6, 8)
    assert len(days) == 5


# ── bulk sign-up ──────────────────────────────────────────────────────────────


def _open_day(day: date, ordered: str | None = None) -> MealDay:
    return MealDay(
        date=day,
        open=True,
        title="Lunch",
        options=[MealMenu("A", "Schnitzel", None, None), MealMenu("B", "Risotto", None, None)],
        ordered_meal=ordered,
        can_be_changed_until=None,
    )


def _closed_day(day: date) -> MealDay:
    return MealDay(
        date=day, open=False, title=None, options=[], ordered_meal=None, can_be_changed_until=None
    )


async def test_bulk_signup_starts_tomorrow_and_orders_preferred(monkeypatch):
    tomorrow = date.today() + timedelta(days=1)
    requested_days: list[date] = []
    ordered: list[tuple[date, str]] = []

    async def fake_meals(edupage, days):
        requested_days.extend(days)
        # day 0 open & free → order; day 1 closed → skip;
        # day 2 already ordered → skip; day 3 open & free → order.
        return [
            _open_day(days[0]),
            _closed_day(days[1]),
            _open_day(days[2], "B"),
            _open_day(days[3]),
        ]

    async def fake_order(edupage, day, choice):
        ordered.append((day, choice))
        return choice

    monkeypatch.setattr(edupage_service, "fetch_meals", fake_meals)
    monkeypatch.setattr(edupage_service, "order_meal", fake_order)

    updated, skipped = await bulk_signup(object(), days_count=4, preferred_choice="A")

    assert requested_days[0] == tomorrow
    assert updated == 2
    assert skipped == 2
    assert ordered == [(tomorrow, "A"), (tomorrow + timedelta(days=3), "A")]


async def test_bulk_signup_skips_day_missing_preferred_choice(monkeypatch):
    async def fake_meals(edupage, days):
        return [_open_day(days[0])]  # only offers A and B

    async def fake_order(edupage, day, choice):  # pragma: no cover - must not run
        raise AssertionError("order should not be called when choice is unavailable")

    monkeypatch.setattr(edupage_service, "fetch_meals", fake_meals)
    monkeypatch.setattr(edupage_service, "order_meal", fake_order)

    updated, skipped = await bulk_signup(object(), days_count=1, preferred_choice="C")

    assert (updated, skipped) == (0, 1)


async def test_bulk_signup_counts_order_rejection_as_skip(monkeypatch):
    async def fake_meals(edupage, days):
        return [_open_day(days[0])]

    async def fake_order(edupage, day, choice):
        raise EduPageDataError("order_failed", "Past the deadline.")

    monkeypatch.setattr(edupage_service, "fetch_meals", fake_meals)
    monkeypatch.setattr(edupage_service, "order_meal", fake_order)

    updated, skipped = await bulk_signup(object(), days_count=1, preferred_choice="A")

    assert (updated, skipped) == (0, 1)
