# AstroPage — Backend

FastAPI service that authenticates against EduPage, proxies data to the frontend, and runs the AI homework assistant pipeline.

## Quick start

```bash
cp .env.example .env      # fill in secrets
make install              # install deps with uv
docker compose up -d db   # start Postgres
make dev-backend          # FastAPI on http://localhost:8000 with live reload
```

- API docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

## Architecture

```
app/
  main.py                    # FastAPI app, lifespan (DB init), middleware
  core/
    config.py                # Settings via pydantic-settings (reads .env)
    security.py              # Fernet encryption, JWT helpers
    logging.py               # Structured logging setup
  api/
    deps.py                  # get_edupage_client, get_session, require_user
    v1/
      router.py              # Mounts all endpoint routers
      endpoints/
        auth.py              # /login, /logout, /me
        dashboard.py         # /dashboard/summary
        homework.py          # /homework, /homework/{id}/mark-done, /homework/generate-ai
        timetable.py         # /timetable
        grades.py            # /grades
        canteen.py           # /canteen/meals, /canteen/order
        settings.py          # /settings/ai-rules
  models/
    user.py                  # User + Session (SQLModel tables)
  schemas/
    auth.py, dashboard.py, homework.py, timetable.py, grades.py, canteen.py, settings.py
  services/
    edupage_service.py       # async wrapper over edupage-api
    timetable_service.py     # weekly timetable builder (per-day degradation)
    homework_service.py      # assignment fetch + attachment resolver
    canteen_service.py       # meal listing + order placement
    grades_service.py        # grade parsing (numeric + points-based)
    ai_service.py            # Gemini draft generation (gemini-2.5-flash)
    settings_service.py      # AI rule persistence

agents/
  base_agent.py              # Reusable agentic loop
  example_agent.py           # Calculator demo

scripts/                     # One-off PoC scripts for EduPage reverse-engineering
  poc_timetable.py
  poc_canteen_menu.py
  poc_order_meal.py
  poc_substitutions.py

tests/
  conftest.py                # Shared fixtures (TestClient, mock EduPage)
  unit/                      # Fast, isolated tests
  integration/               # Full HTTP stack tests
```

## EduPage integration patterns

`edupage-api` is a synchronous `requests`-based library that parses EduPage's HTML and internal JSON positionally. Three rules apply everywhere:

1. **Always wrap in `asyncio.to_thread`.** Every `edupage-api` call is a blocking I/O operation; running it on the event loop thread would stall the whole server.
2. **Map all exceptions to clean errors.** The library throws `IndexError`, `KeyError`, and `MissingDataException` from deep inside. Catch all of them in `edupage_service.py` and surface `EduPageDataError` with a safe, client-visible message.
3. **Verify every write.** EduPage returns HTTP 200 for no-ops. After any mutation, read the result back and confirm it applied before returning success.

The timetable uses `get_timetable(student, day)` (the `currenttt.js` endpoint) rather than `get_my_timetable()` (the dashboard plan endpoint). The dashboard plan silently drops days it didn't include in the response; the explicit endpoint is consistent.

## AI pipeline

`ai_service.generate_draft()`:
- Builds inline `types.Part` objects for each attachment (PDF, image, text; ≤ 20 MB; unsupported MIME types are skipped).
- Appends a text part with the assignment subject, title, and instructions.
- Prepends the student's custom prompt (from Settings), then always appends `STUDY_ASSISTANT_CONSTRAINT` — this cannot be removed by any custom instruction.
- Calls `gemini-2.5-flash` asynchronously via `client.aio.models.generate_content`.
- Returns the markdown draft string. Falls back to an offline template if `GEMINI_API_KEY` is not set.

## Commands

```bash
uv sync --extra dev                              # install deps
uv run uvicorn app.main:app --reload --port 8000 # dev server
uv run pytest -v --tb=short                      # tests
uv run ruff check .                              # lint
uv run ruff format .                             # format
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `APP_ENV` | no | `development` (default) or `production` |
| `APP_DEBUG` | no | Enable debug logging + SQL echo |
| `PORT` | no | Uvicorn port (default 8000) |
| `SECRET_KEY` | prod | HMAC signing key |
| `DATABASE_URL` | yes | Async Postgres URL (`postgresql+asyncpg://…`) |
| `JWT_SECRET` | prod | Signs session JWTs |
| `JWT_TTL_MINUTES` | no | Session lifetime (default 720) |
| `FERNET_KEY` | prod | Encrypts EduPage cookies at rest; derived from `SECRET_KEY` if blank |
| `FRONTEND_ORIGIN` | no | CORS-allowed origin (default `http://localhost:5173`) |
| `GEMINI_API_KEY` | AI only | Gemini API key; fallback template used if unset |

## Adding a new resource

Follow this order — no skipping:

1. `app/models/<name>.py` — domain dataclass
2. `app/schemas/<name>.py` — Pydantic request/response schemas
3. `app/services/<name>_service.py` — business logic
4. `app/api/v1/endpoints/<name>.py` — FastAPI router
5. Register in `app/api/v1/router.py`
6. `tests/unit/test_<name>.py` + `tests/integration/test_<name>.py`

See `CLAUDE.md` for full conventions and `AGENTS.md` for AI-assisted development.
