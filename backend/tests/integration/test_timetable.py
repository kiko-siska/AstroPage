"""Timetable week endpoint — hermetic (EduPage fetcher monkeypatched)."""

from datetime import date, timedelta

from app.services import edupage_service
from app.services.edupage_service import EduPageDataError, TimetablePeriod


def _period(subject: str = "Math") -> TimetablePeriod:
    return TimetablePeriod(1, "08:00", "08:45", subject, "B204", "Mgr. H", False, None)


def test_week_requires_auth(client):
    assert client.get("/api/v1/timetable/week").status_code == 401


def test_week_returns_five_weekdays(auth_client, monkeypatch):
    async def fake_timetable(edupage, day):
        return [_period()]

    monkeypatch.setattr(edupage_service, "fetch_timetable", fake_timetable)

    res = auth_client.get("/api/v1/timetable/week")
    assert res.status_code == 200
    body = res.json()
    assert len(body["days"]) == 5
    assert date.fromisoformat(body["week_start"]).weekday() == 0  # Monday
    assert body["days"][0]["available"] is True
    assert body["days"][0]["periods"][0]["subject"] == "Math"


def test_week_degrades_a_failing_day(auth_client, monkeypatch):
    async def fake_timetable(edupage, day):
        if day.weekday() == 2:  # Wednesday scrape fails
            raise EduPageDataError("timetable_failed", "boom")
        return [_period()]

    monkeypatch.setattr(edupage_service, "fetch_timetable", fake_timetable)

    res = auth_client.get("/api/v1/timetable/week")
    assert res.status_code == 200
    days = res.json()["days"]
    assert days[2]["available"] is False
    assert days[2]["periods"] == []
    assert days[0]["available"] is True  # other days unaffected


def test_week_offset_shifts_by_seven_days(auth_client, monkeypatch):
    async def fake_timetable(edupage, day):
        return []

    monkeypatch.setattr(edupage_service, "fetch_timetable", fake_timetable)

    this_week = auth_client.get("/api/v1/timetable/week?offset=0").json()["week_start"]
    next_week = auth_client.get("/api/v1/timetable/week?offset=1").json()["week_start"]
    assert date.fromisoformat(next_week) == date.fromisoformat(this_week) + timedelta(days=7)


def test_week_offset_out_of_range_is_422(auth_client):
    assert auth_client.get("/api/v1/timetable/week?offset=99").status_code == 422
