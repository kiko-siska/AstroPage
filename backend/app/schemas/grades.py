from datetime import date

from pydantic import BaseModel


class GradeOut(BaseModel):
    """One numeric grade on a subject's report card."""

    id: str
    value: str
    # EduPage weight points; 20 is a normal-weight grade.
    weight: int
    description: str
    date: date | None


class SubjectGradesOut(BaseModel):
    """All grades for one subject plus its weighted average."""

    subject_name: str
    current_average: float | None
    grades: list[GradeOut]


class GradesResponse(BaseModel):
    subjects: list[SubjectGradesOut]
