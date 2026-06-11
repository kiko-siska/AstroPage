# AGENTS.md — Cross-tool agent instructions

This file is read by AI coding agents (Claude Code, Cursor, Codex, Copilot Workspace, etc.)
when working in this repository. It extends `CLAUDE.md` with universal conventions.

## What this repo is

A FastAPI skeleton with a built-in agentic layer (`agents/`). When you modify this codebase,
treat `CLAUDE.md` as the authoritative source for architecture and commands.

## Do

- Run `make lint` and `make test` before marking any task done.
- Follow the existing resource pattern (model → schema → service → endpoint → tests).
- Keep the `agents/` and `app/` layers separate — agents should call app services, not HTTP.
- Use `uv` for all package management. Do not create or modify `requirements.txt`.

## Don't

- Don't add dependencies without updating `pyproject.toml`.
- Don't commit `.env` — it is gitignored for a reason.
- Don't bypass the `reset_item_store` fixture in tests.
- Don't add database dependencies to the skeleton — leave it storage-agnostic.

## When adding a new feature

1. Add model in `app/models/`
2. Add Pydantic schemas in `app/schemas/`
3. Add business logic in `app/services/`
4. Add endpoint in `app/api/v1/endpoints/` and register in `app/api/v1/router.py`
5. Add tests in `tests/unit/` and `tests/integration/`
