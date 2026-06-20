"""Dashboard summary endpoint — hermetic (EduPage fetchers monkeypatched)."""

from datetime import datetime, timedelta

from app.services import edupage_service
from app.services.edupage_service import HomeworkAssignment, TimetablePeriod


def _assignment(id_: str, due_in_hours: float | None, done: bool = False) -> HomeworkAssignment:
    due = datetime.now() + timedelta(hours=due_in_hours) if due_in_hours is not None else None
    return HomeworkAssignment(
        id=id_,
        subject="Math",
        title=f"hw {id_}",
        description="desc",
        teacher="Mgr. H",
        assigned_at=datetime.now() - timedelta(days=1),
        due_date=due,
        is_done=done,
    )


def test_summary_requires_auth(client):
    res = client.get("/api/v1/dashboard/summary")
    assert res.status_code == 401


def test_summary_aggregates_metrics(auth_client, monkeypatch):
    periods = [
        TimetablePeriod(1, "08:00", "08:45", "Math", "B204", "Mgr. H", False, None),
        TimetablePeriod(2, "08:55", "09:40", "German", "A115", "Frau B", True, None),
    ]
    assignments = [
        _assignment("1", due_in_hours=5),  # pending, due soon
        _assignment("2", due_in_hours=90),  # pending, not soon
        _assignment("3", due_in_hours=2, done=True),  # done — excluded
        _assignment("4", due_in_hours=None),  # pending, no due date
    ]

    async def fake_timetable(edupage, day):
        return periods

    async def fake_homework(edupage):
        return assignments

    monkeypatch.setattr(edupage_service, "fetch_timetable", fake_timetable)
    monkeypatch.setattr(edupage_service, "fetch_homework", fake_homework)

    res = auth_client.get("/api/v1/dashboard/summary")
    assert res.status_code == 200
    body = res.json()
    assert body["pending_homework"] == 3
    assert body["due_within_24h"] == 1
    assert body["lessons_total"] == 2
    assert body["lessons_cancelled"] == 1
    assert body["schedule"][1]["is_cancelled"] is True


def test_summary_degrades_when_timetable_unavailable(auth_client, monkeypatch):
    # A flaky timetable must not sink the whole dashboard — homework still shows
    # and the schedule reports as unavailable rather than "no lessons".
    async def boom(edupage, day):
        raise edupage_service.EduPageDataError("timetable_failed", "Could not load the timetable.")

    async def fake_homework(edupage):
        return [_assignment("1", due_in_hours=5)]

    monkeypatch.setattr(edupage_service, "fetch_timetable", boom)
    monkeypatch.setattr(edupage_service, "fetch_homework", fake_homework)

    res = auth_client.get("/api/v1/dashboard/summary")
    assert res.status_code == 200
    body = res.json()
    assert body["schedule_available"] is False
    assert body["lessons_total"] == 0
    assert body["schedule"] == []
    assert body["pending_homework"] == 1


def test_summary_homework_failure_is_502(auth_client, monkeypatch):
    async def fake_timetable(edupage, day):
        return []

    async def boom(edupage):
        raise edupage_service.EduPageDataError("homework_failed", "Could not load homework.")

    monkeypatch.setattr(edupage_service, "fetch_timetable", fake_timetable)
    monkeypatch.setattr(edupage_service, "fetch_homework", boom)

    res = auth_client.get("/api/v1/dashboard/summary")
    assert res.status_code == 502
