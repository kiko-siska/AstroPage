"""homework_service: school-year window used for listing + id resolution."""

from datetime import date

from app.services import edupage_service, homework_service


def test_school_year_start_before_august_is_previous_year():
    assert homework_service._school_year_start(date(2026, 6, 17)) == date(2025, 8, 1)


def test_school_year_start_in_august_is_current_year():
    assert homework_service._school_year_start(date(2026, 8, 3)) == date(2026, 8, 1)


def test_school_year_start_after_august_is_current_year():
    assert homework_service._school_year_start(date(2026, 11, 1)) == date(2026, 8, 1)


async def test_list_assignments_fetches_whole_school_year(monkeypatch):
    captured: dict[str, object] = {}

    async def fake_fetch(edupage, since=None):
        captured["since"] = since
        return []

    monkeypatch.setattr(edupage_service, "fetch_homework", fake_fetch)

    await homework_service.list_assignments(object())

    # Not the small default window — the full academic-year backlog.
    assert captured["since"] == homework_service._school_year_start()
