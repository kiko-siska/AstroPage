from datetime import date

from pydantic import BaseModel


class GradeOut(BaseModel):
    """One numeric grade on a subject's report card."""

    id: str
    # Classic: "1".."5". Points: the earned points (e.g. "5"), paired with
    # max_points so the client can render "5/10".
    value: str
    # EduPage weight points; 20 is a normal-weight grade.
    weight: int
    description: str
    date: date | None
    # Max points for a points/percentage grade; None for classic 1–5 grades.
    max_points: float | None = None


class SubjectGradesOut(BaseModel):
    """All grades for one subject plus its average."""

    subject_name: str
    # Classic subjects: weighted 1–5 average. Points subjects: percentage.
    current_average: float | None
    # True when graded in points/percent (current_average is then a percentage).
    is_points: bool = False
    grades: list[GradeOut]


class GradesResponse(BaseModel):
    subjects: list[SubjectGradesOut]
