# ── Build stage ────────────────────────────────────────────────────────────────
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /app

# Install dependencies into a venv (no editable install — just the deps)
COPY pyproject.toml .
RUN uv sync --no-install-project --no-dev

# Copy source and install the project itself
COPY app/ app/
COPY agents/ agents/
RUN uv sync --no-dev

# ── Runtime stage ───────────────────────────────────────────────────────────────
FROM python:3.12-slim-bookworm AS runtime

WORKDIR /app

# Copy the virtual environment and source from the builder
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/app /app/app
COPY --from=builder /app/agents /app/agents

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
