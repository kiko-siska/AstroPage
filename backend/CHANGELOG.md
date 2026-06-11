# Changelog

All notable changes to this project are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
Versioning: [Semantic Versioning](https://semver.org/)

## [Unreleased]

### Added
- Initial project skeleton with FastAPI, uvicorn, pydantic-settings
- In-memory CRUD for `Item` resource
- Agentic layer (`agents/base_agent.py`, `agents/example_agent.py`)
- Docker and docker-compose setup (production + dev)
- GitHub Actions CI workflow (lint + test on Python 3.11 and 3.12)
- GitHub Actions CD workflow template (GHCR push)
- CLAUDE.md and AGENTS.md for AI-assisted development
