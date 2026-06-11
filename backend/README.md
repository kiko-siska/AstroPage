# FastAPI Skeleton

A production-ready FastAPI skeleton with clean architecture, an agentic layer, and full CI/CD wiring. Use this as your starting point.

## Quick start

```bash
cp .env.example .env      # set your config
make install              # install deps with uv
make dev                  # start server with live reload
```

- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

## Project structure

```
app/                      # FastAPI application
  core/                   # Config, security, logging
  api/v1/endpoints/       # Route handlers
  models/                 # Domain dataclasses
  schemas/                # Pydantic I/O schemas
  services/               # Business logic (swap in DB here)

agents/                   # Agentic layer (Anthropic SDK)
  base_agent.py           # Reusable agentic loop
  example_agent.py        # Calculator agent demo

tests/
  unit/                   # Isolated unit tests
  integration/            # Full HTTP stack tests
```

## Commands

| Command         | Description                        |
|-----------------|------------------------------------|
| `make install`  | Install all deps via uv            |
| `make dev`      | Live-reload dev server             |
| `make test`     | Run full test suite                |
| `make lint`     | Ruff linter                        |
| `make format`   | Ruff formatter                     |

## Docker

```bash
# Production
docker compose up --build

# Development (live reload with volume mounts)
docker compose -f docker-compose.dev.yml up --build
```

## Agents

The `agents/` layer requires `ANTHROPIC_API_KEY`. It is completely independent of the FastAPI app — you can run the app without it.

```bash
ANTHROPIC_API_KEY=sk-... uv run python -m agents.example_agent
```

## Adding a new resource

1. `app/models/<name>.py` — domain dataclass
2. `app/schemas/<name>.py` — Pydantic request/response schemas
3. `app/services/<name>_service.py` — business logic
4. `app/api/v1/endpoints/<name>.py` — route handlers
5. Register router in `app/api/v1/router.py`
6. Add tests in `tests/unit/` and `tests/integration/`

See `CLAUDE.md` and `AGENTS.md` for AI-assisted development instructions.

## License

MIT — see [LICENSE](LICENSE).
