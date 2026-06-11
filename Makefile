.PHONY: install dev dev-backend dev-frontend test lint format docker clean help

install:
	cd backend && uv sync --extra dev
	cd frontend && npm install

dev-backend:
	cd backend && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port $${PORT:-8000}

dev-frontend:
	cd frontend && npm run dev

dev:
	@echo "Start backend and frontend in separate terminals:"
	@echo "  make dev-backend"
	@echo "  make dev-frontend"

test:
	cd backend && uv run pytest -v --tb=short

lint:
	cd backend && uv run ruff check .
	cd frontend && npm run lint 2>/dev/null || true

format:
	cd backend && uv run ruff format .

docker:
	docker compose up --build

clean:
	find backend -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null; \
	find backend -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null; \
	find backend -type d -name .ruff_cache  -exec rm -rf {} + 2>/dev/null; \
	find backend -name "*.pyc" -delete; \
	rm -rf frontend/dist frontend/node_modules

help:
	@echo "Available targets:"
	@echo "  install       Install all dependencies (backend + frontend)"
	@echo "  dev-backend   Start FastAPI dev server (port 8000)"
	@echo "  dev-frontend  Start Vite dev server (port 5173)"
	@echo "  test          Run backend test suite"
	@echo "  lint          Lint backend (ruff) and frontend (eslint)"
	@echo "  format        Format backend with ruff"
	@echo "  docker        Build and run full stack with Docker Compose"
	@echo "  clean         Remove build artifacts"
