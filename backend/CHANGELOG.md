# Changelog

All notable changes to this project are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
Versioning: [Semantic Versioning](https://semver.org/)

## [Unreleased]

### Added
- Full EduPage integration: dashboard summary, homework (with e-test attachment resolver), timetable, grades, canteen, settings
- AI homework draft generation via Google Gemini (`gemini-2.5-flash`) with inline attachment support (PDFs, images, text)
- `STUDY_ASSISTANT_CONSTRAINT` always appended to AI system prompt — draft + explain, never auto-submit
- Fernet-encrypted EduPage session storage in Postgres
- JWT-based auth in `HttpOnly` cookie; no passwords stored or logged
- Per-day timetable degradation: one failed day never blanks the whole week
- Timetable switched from flaky `get_my_timetable()` to reliable `get_timetable(student, day)` (`currenttt.js` endpoint)
- Mark-homework-done uses `superid:<n>` form and verifies the write by reading `doneMaxCas` back (EduPage returns 200 for no-ops)
- E-test attachment resolver: decodes `eqap=base64(querystring)` POST body, walks card widgets for `{name, src}` files
- `EduPageDataError` maps all `edupage-api` positional-parse failures to clean client-safe errors
- CD workflow (`.github/workflows/cd.yml`): self-hosted runner deploys to home server on push to `main`; `docker compose up --build` + `/health` gate; no registry, no inbound ports
- Structured logging via `app/core/logging.py`; full exception tracebacks logged on timetable and EduPage failures
- Integration and unit test suites for all resource slices

### Changed
- AI model bumped from `gemini-2.0-flash` (404'd) to `gemini-2.5-flash`
- `timetable_service.build_week()` now fetches days with `fetch_timetable(edupage, day)` and logs unavailable days with a warning instead of silently dropping them

### Initial skeleton (2026-06-11)
- FastAPI project with `uv`, async SQLAlchemy + SQLModel over Postgres
- In-memory CRUD for `Item` resource
- Agentic layer (`agents/base_agent.py`, `agents/example_agent.py`)
- Docker and docker-compose setup
- GitHub Actions CI workflow (ruff + pytest on Python 3.11 and 3.12)
- `CLAUDE.md` and `AGENTS.md` for AI-assisted development
