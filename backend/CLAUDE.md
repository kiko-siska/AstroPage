# CLAUDE.md — Backend (FastAPI)

> Root instructions: [`../CLAUDE.md`](../CLAUDE.md) — read that first.

This file covers backend-specific conventions. The backend lives in `backend/` and is a FastAPI app with an agentic layer built on Claude.

The in-memory item store is a placeholder — replace it with a real DB service when persistence is needed.

## Architecture

```
app/
  main.py              # FastAPI app + lifespan + middleware
  core/
    config.py          # Settings (pydantic-settings, reads .env)
    security.py        # HMAC signing helpers
    logging.py         # Structured logging setup
  api/
    deps.py            # Shared FastAPI dependencies
    v1/
      router.py        # Mounts all v1 endpoint routers
      endpoints/
        items.py       # CRUD for Item resource
  models/item.py       # Dataclass (domain model)
  schemas/item.py      # Pydantic I/O schemas
  services/
    item_service.py    # Business logic + in-memory store

agents/
  base_agent.py        # Reusable agentic loop (tool-use → observe → repeat)
  example_agent.py     # Calculator agent — run to verify agent wiring

tests/
  conftest.py          # Shared fixtures (TestClient, store reset)
  unit/                # Fast, isolated tests
  integration/         # Tests that exercise the full HTTP stack
```

## Commands

Run from `backend/` or use the root `Makefile` equivalents.

```bash
uv sync --extra dev                                        # install deps
uv run uvicorn app.main:app --reload --port 8000           # dev server
uv run pytest -v --tb=short                                # tests
uv run ruff check .                                        # lint
uv run ruff format .                                       # format
```

## Conventions

- **Package manager**: `uv`. Never add bare `requirements.txt`. Edit `pyproject.toml`.
- **Linter/formatter**: `ruff`. Run `make lint` before committing.
- **Python version**: 3.11+ (uses `str | None` union syntax, not `Optional`).
- **New resource**: add model → schema → service → endpoint → tests. Follow the existing `items` pattern exactly.
- **Database**: async SQLAlchemy + SQLModel over Postgres. The engine and `get_session` dependency live in `app/db/session.py`; tables are created on startup via `init_db()` in the lifespan. Inject `Annotated[AsyncSession, Depends(get_session)]` into endpoints. (The `items` resource still uses an in-memory store in `item_service.py` as a demo — real resources use the DB.)
- **EduPage calls block**: `edupage-api` is synchronous (`requests`). Always wrap calls in `asyncio.to_thread` (see `app/services/edupage_service.py`) and map its positional-parsing failures to clean errors — never let them surface as 500s.
- **Secrets**: passwords are used once at login and never stored or logged. EduPage session cookies are Fernet-encrypted (`app/core/security.py`) before going in the DB.
- **Agents**: need `ANTHROPIC_API_KEY` set. They are opt-in and do not affect the FastAPI app at runtime.
- **Tests**: `conftest.py` resets the item store between every test via `autouse`. Don't bypass this.

## Environment variables

See `.env.example`. Copy to `.env` before running locally.

| Variable           | Required | Description                                |
|--------------------|----------|--------------------------------------------|
| `APP_ENV`          | no       | `development` (default) or `production`    |
| `APP_DEBUG`        | no       | Enable debug logging (also echoes SQL)     |
| `PORT`             | no       | Uvicorn port (default 8000)                |
| `SECRET_KEY`       | yes (prod) | HMAC signing key — change before deploying |
| `DATABASE_URL`     | yes      | Async Postgres URL (`postgresql+asyncpg://…`) |
| `JWT_SECRET`       | yes (prod) | Signs session JWTs — change before deploying |
| `JWT_TTL_MINUTES`  | no       | Session lifetime (default 720)             |
| `FERNET_KEY`       | yes (prod) | Encrypts EduPage cookies at rest; derived from `SECRET_KEY` if blank |
| `FRONTEND_ORIGIN`  | no       | CORS-allowed origin (default `http://localhost:5173`) |
| `ANTHROPIC_API_KEY`| AI/agents only | Required for the homework assistant and `agents/` |
