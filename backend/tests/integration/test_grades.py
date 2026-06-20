"""Grades endpoint — hermetic (no EduPage, no Postgres)."""

from datetime import date

from app.services import edupage_service
from app.services.edupage_service import StudentGrade


def test_grades_requires_auth(client):
    assert client.get("/api/v1/grades").status_code == 401


def test_grades_grouped_with_average(auth_client, monkeypatch):
    async def fake_grades(edupage):
        return [
            StudentGrade(
                id="g1",
                subject_name="Mathematics",
                value="1",
                numeric_value=1.0,
                weight=20,
                description="Quarterly Exam",
                date=date(2026, 5, 12),
            ),
            StudentGrade(
                id="g2",
                subject_name="Mathematics",
                value="3",
                numeric_value=3.0,
                weight=10,
                description="Small Quiz",
                date=date(2026, 6, 2),
            ),
        ]

    monkeypatch.setattr(edupage_service, "fetch_grades", fake_grades)

    res = auth_client.get("/api/v1/grades")
    assert res.status_code == 200
    body = res.json()
    [subject] = body["subjects"]
    assert subject["subject_name"] == "Mathematics"
    # (1*20 + 3*10) / 30 = 1.67
    assert subject["current_average"] == 1.67
    assert [g["id"] for g in subject["grades"]] == ["g2", "g1"]
    assert subject["grades"][0]["weight"] == 10
    assert subject["grades"][1]["date"] == "2026-05-12"


def test_points_subject_reports_percentage(auth_client, monkeypatch):
    async def fake_grades(edupage):
        return [
            StudentGrade(
                id="p1",
                subject_name="Biology",
                value="10",
                numeric_value=10.0,
                weight=20,
                description="Lab Test",
                date=date(2026, 5, 1),
                max_points=10.0,
            ),
            StudentGrade(
                id="p2",
                subject_name="Biology",
                value="5",
                numeric_value=5.0,
                weight=20,
                description="Quiz",
                date=date(2026, 5, 8),
                max_points=10.0,
            ),
        ]

    monkeypatch.setattr(edupage_service, "fetch_grades", fake_grades)

    res = auth_client.get("/api/v1/grades")
    assert res.status_code == 200
    [subject] = res.json()["subjects"]
    assert subject["is_points"] is True
    # (10 + 5) / (10 + 10) × 100 = 75%
    assert subject["current_average"] == 75.0
    assert subject["grades"][0]["max_points"] == 10.0


def test_grades_filters_verbal_entries(auth_client, monkeypatch):
    async def fake_grades(edupage):
        return [
            StudentGrade(
                id="g1",
                subject_name="History",
                value="Absent",
                numeric_value=None,
                weight=0,
                description="Note",
                date=None,
            )
        ]

    monkeypatch.setattr(edupage_service, "fetch_grades", fake_grades)

    res = auth_client.get("/api/v1/grades")
    assert res.status_code == 200
    assert res.json() == {"subjects": []}


def test_grades_edupage_failure_is_502(auth_client, monkeypatch):
    async def fake_grades(edupage):
        raise edupage_service.EduPageDataError("grades_failed", "Could not load grades.")

    monkeypatch.setattr(edupage_service, "fetch_grades", fake_grades)

    res = auth_client.get("/api/v1/grades")
    assert res.status_code == 502
