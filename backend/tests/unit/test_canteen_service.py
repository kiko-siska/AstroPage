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
    first_call_days: list[date] = []
    ordered: list[tuple[date, str]] = []
    persisted: dict[date, str] = {}

    # day 0 open & free → order; day 1 closed → skip;
    # day 2 already ordered "B" → skip; day 3 open & free → order.
    closed = {tomorrow + timedelta(days=1)}
    preexisting = {tomorrow + timedelta(days=2): "B"}

    async def fake_meals(edupage, days):
        if not first_call_days:
            first_call_days.extend(days)
        out = []
        for d in days:
            if d in closed:
                out.append(_closed_day(d))
            else:
                out.append(_open_day(d, persisted.get(d, preexisting.get(d))))
        return out

    async def fake_order(edupage, day, choice, verify=True):
        ordered.append((day, choice))
        persisted[day] = choice  # the order lands
        return choice

    monkeypatch.setattr(edupage_service, "fetch_meals", fake_meals)
    monkeypatch.setattr(edupage_service, "order_meal", fake_order)

    updated, skipped = await bulk_signup(object(), days_count=4, preferred_choice="A")

    assert first_call_days[0] == tomorrow
    assert updated == 2  # day 0 and day 3 confirmed as "A"
    assert skipped == 2  # day 1 closed, day 2 already ordered
    assert ordered == [(tomorrow, "A"), (tomorrow + timedelta(days=3), "A")]


async def test_bulk_signup_counts_only_orders_that_persist(monkeypatch):
    # order_meal is fired (verify=False) but nothing ever shows up on the
    # confirmation fetch → all candidates count as skipped, not updated.
    async def fake_meals(edupage, days):
        return [_open_day(d) for d in days]  # always open, never ordered

    async def fake_order(edupage, day, choice, verify=True):
        return choice  # claims success, but fake_meals never reflects it

    monkeypatch.setattr(edupage_service, "fetch_meals", fake_meals)
    monkeypatch.setattr(edupage_service, "order_meal", fake_order)

    updated, skipped = await bulk_signup(object(), days_count=3, preferred_choice="A")

    assert (updated, skipped) == (0, 3)


async def test_bulk_signup_skips_day_missing_preferred_choice(monkeypatch):
    async def fake_meals(edupage, days):
        return [_open_day(days[0])]  # only offers A and B

    async def fake_order(edupage, day, choice, verify=True):  # pragma: no cover - must not run
        raise AssertionError("order should not be called when choice is unavailable")

    monkeypatch.setattr(edupage_service, "fetch_meals", fake_meals)
    monkeypatch.setattr(edupage_service, "order_meal", fake_order)

    updated, skipped = await bulk_signup(object(), days_count=1, preferred_choice="C")

    assert (updated, skipped) == (0, 1)


async def test_bulk_signup_order_exception_does_not_abort(monkeypatch):
    # A thrown order doesn't stop the run; the confirmation fetch decides the
    # outcome (here the order didn't land → skipped).
    async def fake_meals(edupage, days):
        return [_open_day(d) for d in days]

    async def fake_order(edupage, day, choice, verify=True):
        raise EduPageDataError("order_failed", "Past the deadline.")

    monkeypatch.setattr(edupage_service, "fetch_meals", fake_meals)
    monkeypatch.setattr(edupage_service, "order_meal", fake_order)

    updated, skipped = await bulk_signup(object(), days_count=1, preferred_choice="A")

    assert (updated, skipped) == (0, 1)
