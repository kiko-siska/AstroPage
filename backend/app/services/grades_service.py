"""Grade grouping and weighted-average computation.

EduPage returns a flat list of grades. This module groups them by subject,
drops purely narrative (verbal / non-numeric) entries that don't move the
average, and computes the weighted average each subject's report card shows.
"""

import logging
from dataclasses import dataclass
from datetime import date

from edupage_api import Edupage

from app.services import edupage_service
from app.services.edupage_service import StudentGrade

logger = logging.getLogger("app.grades")


@dataclass
class SubjectGrades:
    subject_name: str
    # Classic subjects: weighted 1–5 average. Points subjects: overall
    # percentage (0–100). None when a subject has nothing to average on.
    current_average: float | None
    # True when the subject is graded in points/percent — drives both the
    # average semantics above and how the client renders the figure.
    is_points: bool
    grades: list[StudentGrade]


def _weighted_average(grades: list[StudentGrade]) -> float | None:
    """Σ(value × weight) / Σ(weight) over numeric grades with positive weight."""
    total_weight = 0
    total = 0.0
    for g in grades:
        if g.numeric_value is None or g.weight <= 0:
            continue
        total += g.numeric_value * g.weight
        total_weight += g.weight
    if total_weight == 0:
        return None
    return round(total / total_weight, 2)


def _points_percentage(grades: list[StudentGrade]) -> float | None:
    """Σ(earned) / Σ(max) × 100 over points grades.

    Mirrors EduPage's points scoring: a 1/0 grade adds 1 to the numerator and
    0 to the denominator. Returns None when no points can be totalled (e.g. a
    lone 1/0), since there's nothing to divide by.
    """
    earned = 0.0
    total = 0.0
    for g in grades:
        if g.max_points is None or g.numeric_value is None:
            continue
        earned += g.numeric_value
        total += g.max_points
    if total <= 0:
        return None
    return round(earned / total * 100, 2)


def _summarise(grades: list[StudentGrade]) -> tuple[float | None, bool]:
    """Return (average, is_points) for one subject.

    A subject is points-based as soon as any of its grades carries a
    max_points; otherwise it's a classic 1–5 subject.
    """
    if any(g.max_points is not None for g in grades):
        return _points_percentage(grades), True
    return _weighted_average(grades), False


async def list_grades(edupage: Edupage) -> list[SubjectGrades]:
    """Grades grouped by subject with a weighted average, sorted by subject name.

    Verbal / non-numeric remarks are filtered out — they carry no weight and
    only the average-relevant grades are returned to the client.
    """
    raw = await edupage_service.fetch_grades(edupage)

    by_subject: dict[str, list[StudentGrade]] = {}
    for grade in raw:
        if grade.numeric_value is None:
            continue
        by_subject.setdefault(grade.subject_name, []).append(grade)

    subjects = []
    for name, grades in by_subject.items():
        average, is_points = _summarise(grades)
        subjects.append(
            SubjectGrades(
                subject_name=name,
                current_average=average,
                is_points=is_points,
                # Most recent grade first within each subject (undated last).
                grades=sorted(grades, key=lambda g: g.date or date.min, reverse=True),
            )
        )
    subjects.sort(key=lambda s: s.subject_name.lower())
    return subjects
