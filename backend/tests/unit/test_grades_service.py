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


async def test_points_grades_average_is_percentage(patch_fetch):
    # Σ(earned) / Σ(max) × 100 = (10 + 5 + 3) / (10 + 10 + 12) = 18/32 = 56.25%
    patch_fetch(
        [
            _grade(id="1", numeric_value=10.0, value="10", max_points=10.0),
            _grade(id="2", numeric_value=5.0, value="5", max_points=10.0),
            _grade(id="3", numeric_value=3.0, value="3", max_points=12.0),
        ]
    )
    [subject] = await grades_service.list_grades(object())
    assert subject.is_points is True
    assert subject.current_average == 56.25


async def test_points_grade_with_zero_max_adds_to_numerator_only(patch_fetch):
    # A 1/0 grade contributes 1 to earned and 0 to max: (10 + 1) / (10 + 0) = 110%.
    patch_fetch(
        [
            _grade(id="1", numeric_value=10.0, value="10", max_points=10.0),
            _grade(id="2", numeric_value=1.0, value="1", max_points=0.0),
        ]
    )
    [subject] = await grades_service.list_grades(object())
    assert subject.is_points is True
    assert subject.current_average == 110.0


async def test_points_average_none_when_total_max_is_zero(patch_fetch):
    # A lone 1/0 has nothing to divide by.
    patch_fetch([_grade(id="1", numeric_value=1.0, value="1", max_points=0.0)])
    [subject] = await grades_service.list_grades(object())
    assert subject.is_points is True
    assert subject.current_average is None


async def test_classic_subject_is_not_points(patch_fetch):
    patch_fetch([_grade(id="1", numeric_value=2.0, value="2", weight=20)])
    [subject] = await grades_service.list_grades(object())
    assert subject.is_points is False


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
