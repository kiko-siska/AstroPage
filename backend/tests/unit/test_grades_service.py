"""grades_service: grouping, weighted average, and narrative filtering."""

from datetime import date

import pytest

from app.services import edupage_service, grades_service
from app.services.edupage_service import StudentGrade


def _grade(**kwargs) -> StudentGrade:
    base = dict(
        id="1",
        subject_name="Mathematics",
        value="1",
        numeric_value=1.0,
        weight=20,
        description="Exam",
        date=date(2026, 5, 12),
    )
    base.update(kwargs)
    return StudentGrade(**base)


@pytest.fixture
def patch_fetch(monkeypatch):
    def _apply(grades: list[StudentGrade]):
        async def fake_fetch(edupage):
            return grades

        monkeypatch.setattr(edupage_service, "fetch_grades", fake_fetch)

    return _apply


async def test_groups_by_subject_sorted(patch_fetch):
    patch_fetch(
        [
            _grade(id="1", subject_name="Physics"),
            _grade(id="2", subject_name="Art"),
        ]
    )
    subjects = await grades_service.list_grades(object())
    assert [s.subject_name for s in subjects] == ["Art", "Physics"]


async def test_weighted_average(patch_fetch):
    # (1*20 + 3*10) / (20 + 10) = 50 / 30 = 1.67
    patch_fetch(
        [
            _grade(id="1", numeric_value=1.0, weight=20),
            _grade(id="2", numeric_value=3.0, weight=10, value="3"),
        ]
    )
    [subject] = await grades_service.list_grades(object())
    assert subject.current_average == 1.67


async def test_verbal_grades_filtered_out(patch_fetch):
    patch_fetch(
        [
            _grade(id="1", numeric_value=2.0, value="2", weight=20),
            _grade(id="2", numeric_value=None, value="Absent", weight=0),
        ]
    )
    [subject] = await grades_service.list_grades(object())
    assert [g.id for g in subject.grades] == ["1"]
    assert subject.current_average == 2.0


async def test_average_none_when_no_numeric_grades(patch_fetch):
    patch_fetch([_grade(id="1", numeric_value=None, weight=0, value="Pass")])
    assert await grades_service.list_grades(object()) == []


async def test_grades_sorted_recent_first(patch_fetch):
    patch_fetch(
        [
            _grade(id="old", date=date(2026, 1, 1)),
            _grade(id="new", date=date(2026, 6, 1)),
            _grade(id="undated", date=None),
        ]
    )
    [subject] = await grades_service.list_grades(object())
    assert [g.id for g in subject.grades] == ["new", "old", "undated"]
