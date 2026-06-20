"""Timetable week endpoint — hermetic (EduPage fetcher monkeypatched)."""

from datetime import date, timedelta

from app.services import edupage_service
from app.services.edupage_service import EduPageDataError, TimetableChange, TimetablePeriod


def _period(subject: str = "Math") -> TimetablePeriod:
    return TimetablePeriod(1, "08:00", "08:45", subject, "B204", "Mgr. H", False, None)


async def _no_changes(edupage, day):
    return []


def test_week_requires_auth(client):
    assert client.get("/api/v1/timetable/week").status_code == 401


def test_week_returns_five_weekdays(auth_client, monkeypatch):
    async def fake_timetable(edupage, day):
        return [_period()]

    monkeypatch.setattr(edupage_service, "fetch_timetable", fake_timetable)
    monkeypatch.setattr(edupage_service, "fetch_timetable_changes", _no_changes)

    res = auth_client.get("/api/v1/timetable/week")
    assert res.status_code == 200
    body = res.json()
    assert len(body["days"]) == 5
    assert date.fromisoformat(body["week_start"]).weekday() == 0  # Monday
    assert body["days"][0]["available"] is True
    assert body["days"][0]["periods"][0]["subject"] == "Math"
    assert body["days"][0]["changes"] == []


def test_week_attaches_class_substitutions(auth_client, monkeypatch):
    async def fake_timetable(edupage, day):
        return [_period()]

    async def fake_changes(edupage, day):
        if day.weekday() == 0:  # only Monday has a substitution
            return [
                TimetableChange(
                    lesson="3", change_class="II.D", title="Math cancelled", action="remove"
                )
            ]
        return []

    monkeypatch.setattr(edupage_service, "fetch_timetable", fake_timetable)
    monkeypatch.setattr(edupage_service, "fetch_timetable_changes", fake_changes)

    days = auth_client.get("/api/v1/timetable/week").json()["days"]
    assert days[0]["changes"] == [
        {"lesson": "3", "change_class": "II.D", "title": "Math cancelled", "action": "remove"}
    ]
    assert days[1]["changes"] == []  # other days unaffected


def test_week_degrades_a_failing_day(auth_client, monkeypatch):
    async def fake_timetable(edupage, day):
        if day.weekday() == 2:  # Wednesday scrape fails
            raise EduPageDataError("timetable_failed", "boom")
        return [_period()]

    monkeypatch.setattr(edupage_service, "fetch_timetable", fake_timetable)
    monkeypatch.setattr(edupage_service, "fetch_timetable_changes", _no_changes)

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
    monkeypatch.setattr(edupage_service, "fetch_timetable_changes", _no_changes)

    this_week = auth_client.get("/api/v1/timetable/week?offset=0").json()["week_start"]
    next_week = auth_client.get("/api/v1/timetable/week?offset=1").json()["week_start"]
    assert date.fromisoformat(next_week) == date.fromisoformat(this_week) + timedelta(days=7)


def test_week_offset_out_of_range_is_422(auth_client):
    assert auth_client.get("/api/v1/timetable/week?offset=99").status_code == 422
