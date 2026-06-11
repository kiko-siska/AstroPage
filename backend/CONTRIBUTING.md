# Contributing

## Getting started

```bash
git clone <repo>
cd fastapi-skeleton
cp .env.example .env
make install
```

## Workflow

1. Create a branch: `git checkout -b feat/your-feature`
2. Make changes
3. `make lint` — must pass
4. `make test` — must pass
5. Open a pull request using the template

## Code style

- Formatter and linter: **ruff** (`make format && make lint`)
- Line length: 100
- Python 3.11+ syntax (`str | None`, not `Optional[str]`)
- No type: ignore comments without an explanation

## Adding a resource

See the "Adding a new resource" section in `README.md`.

## Commit messages

Use imperative mood: `Add item pagination`, `Fix 404 on delete`, `Refactor service layer`.

## Reporting bugs

Use the GitHub issue template: **Bug report**.

## Proposing features

Use the GitHub issue template: **Feature request**.
