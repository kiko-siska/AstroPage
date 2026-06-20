# AstroPage

A modern alternative client portal for EduPage with an integrated AI homework assistant.

## What it is

EduPage is a widely-used school management platform with a rigid default UI. AstroPage replaces that UI with a fast, responsive React dashboard and adds an AI layer that can draft homework solutions for student review — the student always reviews and approves before anything is submitted.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite + TypeScript + Tailwind |
| Backend | FastAPI (Python 3.11+, async throughout) |
| EduPage integration | `edupage-api` Python module |
| AI assistant | Google Gemini (`gemini-2.5-flash`) |
| Database | Postgres via async SQLAlchemy + SQLModel |
| i18n | Custom React context — English (default) + Slovak |

## Features

| Page | Status | Notes |
|---|---|---|
| Login | ✅ | EduPage credential auth; no password stored |
| Dashboard | ✅ | Overview of tasks, today's schedule, lesson cancellations |
| Homework | ✅ | Assignments with attachments; AI draft generation; mark-as-done |
| Timetable | ✅ | Weekly view with substitutions; per-day degradation |
| Grades | ✅ | Weighted averages; what-if sandbox; points-based grades |
| Canteen | ✅ | Meal ordering by week; bulk sign-up/off |
| Settings | ✅ | Custom AI prompt; per-student preferences |

## Architecture

### Auth & sessions
- No passwords stored on the backend. On login, the user provides their username, password, and school subdomain (e.g. `spsezoska`).
- The backend authenticates against that EduPage subdomain via `edupage-api`, Fernet-encrypts the session cookie, and stores it in Postgres. A JWT in an `HttpOnly` cookie is issued to the browser.
- Protected endpoints rehydrate the EduPage client from the stored session on each request.

### Frontend caching
- Every page uses `useCachedResource` — a shared hook that seeds state instantly from a session-scoped in-memory cache, refetches in the background when the TTL expires, and handles tab-focus refresh automatically.
- On login, `prefetchAll()` fires in the background and warms every page's cache sequentially (dashboard first), so the first tab switch after login is typically an instant cache hit.

### AI homework pipeline
1. Student opens an assignment and clicks "AI Draft".
2. Backend fetches the full assignment (text + up to 5 attachments from EduPage).
3. All content is sent to Gemini as inline parts (PDFs, images, text ≤ 20 MB each), along with the student's custom instructions.
4. The `STUDY_ASSISTANT_CONSTRAINT` is always appended — the model must draft *and explain*, never just produce a bare answer.
5. The draft appears in the UI in an editable state. Nothing is ever submitted automatically.

### Internationalisation
- Language is chosen on the login screen and persisted to `localStorage`.
- All UI strings live in `frontend/src/i18n/translations.ts` as a flat EN/SK catalogue.
- Date/number formatting uses `Intl` with `en-GB` or `sk-SK` locale per the active language.
- `tn(key, n)` handles plural forms; Slovak uses a 3-form system (one/few/other).

## Project structure

```
AstroPage/
├── backend/               # FastAPI app
│   ├── app/
│   │   ├── main.py
│   │   ├── api/v1/        # versioned endpoints
│   │   ├── core/          # config, logging, security
│   │   ├── models/        # domain models
│   │   ├── schemas/       # Pydantic I/O schemas
│   │   └── services/      # business logic (edupage, ai, timetable, …)
│   ├── scripts/           # one-off PoC scripts for EduPage reverse-engineering
│   ├── tests/
│   ├── pyproject.toml
│   └── .env.example
├── frontend/              # React + Vite SPA
│   └── src/
│       ├── api/           # client, cache, prefetch, useCachedResource
│       ├── components/    # AppLayout, RefreshButton, LanguageSwitcher
│       ├── context/       # AuthContext
│       ├── i18n/          # LanguageContext, translations
│       └── pages/         # Dashboard, Homework, Timetable, Grades, Canteen, Settings, Login
├── .github/workflows/     # CI (lint+test) + CD (self-hosted runner → home server)
├── docker-compose.yml
└── Makefile
```

## Getting started

**Prerequisites:** Python 3.11+, `uv`, Node.js 20+

```bash
# Install all dependencies
make install

# Copy and fill in environment variables
cp backend/.env.example backend/.env
```

Start Postgres (the backend needs it for sessions):

```bash
docker compose up -d db
```

Then run backend and frontend in separate terminals:

```bash
make dev-backend    # FastAPI on http://localhost:8000
make dev-frontend   # Vite on http://localhost:5173 (proxies /api → :8000)
```

API docs: `http://localhost:8000/docs`

## Environment variables

See `backend/.env.example`. Key variables:

| Variable | Required | Description |
|---|---|---|
| `APP_ENV` | no | `development` (default) or `production` |
| `SECRET_KEY` | prod | HMAC signing key |
| `DATABASE_URL` | yes | Async Postgres URL; defaults match the `db` compose service |
| `JWT_SECRET` | prod | Signs session JWTs |
| `FERNET_KEY` | prod | Encrypts EduPage session cookies at rest; derived from `SECRET_KEY` if unset |
| `FRONTEND_ORIGIN` | no | CORS-allowed frontend origin (default `http://localhost:5173`) |
| `GEMINI_API_KEY` | AI only | Required for AI homework drafts; falls back to an offline template if unset |

## Docker

```bash
make docker    # builds and runs db + backend + frontend via Docker Compose
```

## Deployment

CD is via a self-hosted GitHub Actions runner on the home server. Pushing to `main` triggers the runner to sync the persistent clone and run `docker compose up -d --build`. No registry and no inbound ports — the runner polls GitHub outbound. See `.github/workflows/cd.yml` for details.

## Commands

```bash
make install        # install backend + frontend deps
make dev-backend    # start FastAPI with live reload
make dev-frontend   # start Vite dev server
make test           # run backend test suite
make lint           # ruff + eslint
make format         # ruff format
make docker         # full stack via Docker Compose
make clean          # remove build artifacts
```

## Core constraints (non-negotiable)

- **Never store user passwords.** Not in memory beyond a request, not in the DB, not in logs.
- **Never auto-submit to EduPage.** The human-in-the-loop step is a product constraint.
- **AI response is always a draft.** The frontend renders it in an editable state; the student owns the final submission.
- Treat `edupage-api` as a flaky scraper — wrap every call in `asyncio.to_thread`, map its exceptions to clean errors, and verify every write by reading it back (EduPage returns 200 for no-ops).
