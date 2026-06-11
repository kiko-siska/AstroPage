from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

from app.core.config import settings

# `echo` follows debug so SQL is visible when troubleshooting locally.
engine = create_async_engine(settings.database_url, echo=settings.app_debug, future=True)

async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db() -> None:
    """Create tables from SQLModel metadata. Called from the app lifespan.

    Fine for this project; swap for Alembic migrations once the schema stabilises.
    """
    # Import models so their tables register on SQLModel.metadata before create_all.
    from app import models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding an async DB session."""
    async with async_session_maker() as session:
        yield session
