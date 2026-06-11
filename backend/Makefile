.PHONY: install dev test lint format docker clean help

install:
	uv sync --extra dev

dev:
	uv run uvicorn app.main:app --reload --host 0.0.0.0 --port $${PORT:-8000}

test:
	uv run pytest -v --tb=short

lint:
	uv run ruff check .

format:
	uv run ruff format .

docker:
	# The full stack (db + backend + frontend) is orchestrated from the repo root.
	cd .. && docker compose up --build

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null; \
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null; \
	find . -type d -name .ruff_cache  -exec rm -rf {} + 2>/dev/null; \
	find . -name "*.pyc" -delete

help:
	@echo "Available targets:"
	@echo "  install     Install dependencies (uv sync --extra dev)"
	@echo "  dev         Start live-reload dev server"
	@echo "  test        Run test suite"
	@echo "  lint        Check code with ruff"
	@echo "  format      Auto-format with ruff"
	@echo "  docker      Build and run the full stack from repo root"
	@echo "  clean       Remove __pycache__ and build artifacts"
