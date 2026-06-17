from fastapi import APIRouter

from app.api.v1.endpoints import auth, canteen, dashboard, grades, homework, items, settings

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(dashboard.router)
api_router.include_router(homework.router)
api_router.include_router(grades.router)
api_router.include_router(canteen.router)
api_router.include_router(settings.router)
api_router.include_router(items.router)
