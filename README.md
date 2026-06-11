# AstroPage

A modern alternative client portal for EduPage with an integrated AI homework assistant.

## What it is

EduPage is a widely-used school management platform with a rigid default UI. AstroPage replaces that UI with a fast, responsive React dashboard and adds an AI layer that can draft homework solutions for student review — the student always reviews and approves before anything is submitted.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | FastAPI (Python 3.11+) |
| EduPage integration | `edupage-api` Python module |
| AI assistant | Anthropic Claude API |

## Architecture

### Auth & sessions
- No passwords stored on the backend. On login, the user provides their username, password, and school subdomain (e.g. `schoolname.edupage.org`).
- The backend authenticates against that EduPage subdomain via `edupage-api`, holds the session token in memory, and proxies all subsequent requests on behalf of the user.

### AI homework pipeline
1. Student opens an assignment in the dashboard and clicks "Draft with AI".
2. Backend fetches the full assignment details and attachments from EduPage.
3. Payload is sent to Claude with a study-assistant system prompt — step-by-step reasoning, no auto-submit.
4. Draft appears in the UI. Student reviews, edits, and approves before anything leaves the app.

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
│   │   └── services/      # business logic
│   ├── agents/            # Claude agentic layer
│   ├── tests/
│   ├── pyproject.toml
│   └── .env.example
├── frontend/              # React + Vite SPA
│   └── src/
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

Start Postgres (the backend needs it for users and sessions):

```bash
docker compose up -d db
```

Then run backend and frontend in separate terminals:

```bash
make dev-backend    # FastAPI on http://localhost:8000
make dev-frontend   # Vite on http://localhost:5173 (proxies /api → :8000)
```

API docs are available at `http://localhost:8000/docs` once the backend is running.

## Environment variables

See `backend/.env.example`. Key variables:

| Variable | Description |
|---|---|
| `APP_ENV` | `development` or `production` |
| `SECRET_KEY` | HMAC signing key (required in prod) |
| `DATABASE_URL` | Async Postgres URL; defaults match the `db` compose service |
| `JWT_SECRET` | Signs session JWTs (required in prod) |
| `FERNET_KEY` | Encrypts EduPage session cookies at rest; derived from `SECRET_KEY` if unset |
| `FRONTEND_ORIGIN` | CORS-allowed frontend origin |
| `ANTHROPIC_API_KEY` | Required for the AI homework assistant |

## Docker

```bash
make docker    # builds and runs db + backend + frontend
```

## Commands

```bash
make install        # install backend + frontend deps
make dev-backend    # start FastAPI with live reload
make dev-frontend   # start Vite dev server
make test           # run backend test suite
make lint           # ruff + eslint
make format         # ruff format
make clean          # remove build artifacts
```
