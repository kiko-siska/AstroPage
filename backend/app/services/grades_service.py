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
    # Weighted average over numeric grades, or None when a subject has none.
    current_average: float | None
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

    subjects = [
        SubjectGrades(
            subject_name=name,
            current_average=_weighted_average(grades),
            # Most recent grade first within each subject (undated last).
            grades=sorted(grades, key=lambda g: g.date or date.min, reverse=True),
        )
        for name, grades in by_subject.items()
    ]
    subjects.sort(key=lambda s: s.subject_name.lower())
    return subjects
