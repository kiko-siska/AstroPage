from typing import Annotated

from edupage_api import Edupage
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_edupage_client
from app.schemas.grades import GradeOut, GradesResponse, SubjectGradesOut
from app.services import grades_service
from app.services.edupage_service import EduPageDataError

router = APIRouter(prefix="/grades", tags=["grades"])


@router.get("", response_model=GradesResponse)
async def list_grades(
    edupage: Annotated[Edupage, Depends(get_edupage_client)],
) -> GradesResponse:
    """The student's weighted grades, grouped by subject.

    Read-only: this powers the report card and the client-side sandbox
    simulator. Nothing here is written back to EduPage.
    """
    try:
        subjects = await grades_service.list_grades(edupage)
    except EduPageDataError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=exc.message)

    return GradesResponse(
        subjects=[
            SubjectGradesOut(
                subject_name=s.subject_name,
                current_average=s.current_average,
                grades=[
                    GradeOut(
                        id=g.id,
                        value=g.value,
                        weight=g.weight,
                        description=g.description,
                        date=g.date,
                    )
                    for g in s.grades
                ],
            )
            for s in subjects
        ]
    )
