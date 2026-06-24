# CLAUDE.md — AstroPage

This is the root instructions file. Read this first. Sub-module instructions are linked at the bottom.

---

## What this project is

AstroPage is a modern alternative portal for EduPage (a school management platform). It replaces the default EduPage UI with a fast React SPA and adds an AI homework assistant powered by Claude.

- Students log in with their EduPage credentials and school subdomain
- The backend authenticates against their school's EduPage instance and proxies requests
- An AI pipeline drafts homework solutions for student review — nothing is auto-submitted

See [`README.md`](README.md) for the full project overview.

---

## Repo layout

```
AstroPage/
├── backend/        # FastAPI app — see backend/CLAUDE.md
│   ├── app/db/     # async SQLAlchemy engine + session (Postgres)
│   ├── app/models/ # User + Session SQLModel tables (+ in-memory Item demo)
│   └── app/services/edupage_service.py  # async wrapper over edupage-api
├── frontend/       # React + Vite + Tailwind SPA
│   └── src/{api,context,pages}/  # API client, AuthContext, Login page
├── docker-compose.yml   # db (Postgres) + backend + frontend
├── Makefile
└── README.md
```

State of the build: the auth slice is implemented — `/api/v1/auth/login` validates
credentials against EduPage, stores an encrypted server-side session in Postgres,
and issues a JWT in an HttpOnly cookie. Protected endpoints rehydrate the EduPage
session via `get_edupage_client` in `app/api/deps.py`: dashboard summary, homework
list, AI draft generation (`/homework/generate-ai`, cached in `homework_drafts`),
canteen meals/ordering, and AI-prompt settings. AI drafts fall back to an offline
template when `ANTHROPIC_API_KEY` is unset.

---

## Non-negotiable rules

These apply everywhere in this repo. Never violate them.

### Security
- **Never store user passwords.** Not in memory beyond a request, not in a DB, not in logs.
- **Never log credentials, tokens, or session cookies.** Structured logs must redact these fields.
- **Never auto-submit anything to EduPage** on behalf of the student. The human-in-the-loop step is a core product constraint, not a nice-to-have.
- **Never hardcode secrets.** All secrets go in `.env` (which is gitignored). `.env.example` shows the shape with no real values.
- Validate all input at API boundaries. Never trust client-supplied subdomains or user IDs without sanitization.

### Code quality
- No `print()` for debugging — use the structured logger from `app/core/logging.py`.
- No commented-out code blocks left in PRs.
- No `TODO` without a GitHub issue number attached.
- Type hints everywhere in Python. No bare `dict` or `Any` unless truly unavoidable — explain why in a comment.
- Every new endpoint needs at least one integration test.

### Git
- Branch naming: `feature/<slug>`, `fix/<slug>`, `chore/<slug>`.
- Commit messages: imperative mood, present tense. Example: `add EduPage session proxy endpoint`.
- Never commit `.env`, `.venv`, `node_modules`, or `__pycache__`.
- PRs must pass `make lint` and `make test` before merge.

---

## Architecture decisions (don't reverse without discussion)

| Decision | Reason |
|---|---|
| No password database | Privacy — we are a client portal, not an identity provider |
| Per-subdomain session isolation | Each school is a separate EduPage tenant |
| AI draft is read-only to EduPage | Legal and ethical: student must own the submission |
| FastAPI async throughout | EduPage fetches are I/O-bound; blocking calls must be wrapped with `asyncio.to_thread` |
| Vite proxy for `/api` in dev | Avoids CORS complexity during local development |

---

## Adding a new backend resource

Follow this order exactly — do not skip steps:

1. `backend/app/models/<name>.py` — domain dataclass
2. `backend/app/schemas/<name>.py` — Pydantic request/response schemas
3. `backend/app/services/<name>_service.py` — business logic
4. `backend/app/api/v1/endpoints/<name>.py` — FastAPI router
5. Register the router in `backend/app/api/v1/router.py`
6. `backend/tests/unit/test_<name>.py` — unit tests
7. `backend/tests/integration/test_<name>.py` — integration tests

---

## Adding a new frontend page or feature

1. Add the route in `frontend/src/router` (or wherever routing lives).
2. Co-locate component styles — no global CSS except design tokens.
3. API calls go through a central `frontend/src/api/` client module, never inline `fetch` scattered across components.
4. Never store session tokens in `localStorage`. Use in-memory state or `httpOnly` cookies set by the backend.

---

## AI assistant pipeline rules

When working on the homework assistant feature:

- The system prompt sent to Claude must always include the study-assistant constraint: draft and explain, do not just produce a final answer.
- Never pass raw file bytes to the LLM without first confirming the content type is safe (text, PDF text-layer — no executables).
- Keep the compiled homework payload under 100k tokens. If it exceeds this, summarize attachments rather than including them verbatim.
- The AI response is always returned as a `draft` object — the frontend renders it in an editable state, never as final output.

---

## Dev commands (from repo root)

```bash
make install        # install backend (uv) + frontend (npm) deps
make dev-backend    # FastAPI on :8000 with live reload
make dev-frontend   # Vite on :5173, proxies /api → :8000
make test           # backend pytest suite
make lint           # ruff + eslint
make format         # ruff format
make docker         # full stack via Docker Compose
```

---

## Design system — MANDATORY

**Every frontend change must follow [`DESIGN.md`](DESIGN.md) exactly.** This file is the single source of truth for colors, typography, spacing, shadows, component states, and interaction behavior. Do not deviate from it — not even slightly — without explicit user approval.

Key rules derived from the design:
- Color palette: dark amber/copper (`#B08D57`) on near-black backgrounds (`#0a0805`, `#0e0c09`, `#161208`)
- Fonts: Cormorant Garamond (headings), Inter (body/UI), JetBrains Mono (labels/mono)
- All borders use `rgba(176,141,87,…)` copper tints — no plain grey borders
- All status colors (done/overdue/due-soon/pending) use the exact token values in `DESIGN.md`
- Grain overlay, drawer slide-in, and optimistic-update patterns are required, not optional

---

## Sub-module instructions

- [`backend/CLAUDE.md`](backend/CLAUDE.md) — FastAPI conventions, endpoint patterns, test setup, env vars
