# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| latest  | Yes       |

## Reporting a vulnerability

Do **not** open a public GitHub issue for security vulnerabilities.

Email the maintainer directly (or use GitHub's private security advisory feature):
**Security Advisory → "Report a vulnerability"** on the repository page.

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (optional)

You will receive a response within 72 hours. Please allow time for a patch before public disclosure.

## Security considerations for this skeleton

- `SECRET_KEY` must be a strong random value in production. Generate with:
  ```bash
  python -c "import secrets; print(secrets.token_hex(32))"
  ```
- `ANTHROPIC_API_KEY` must never be committed to version control.
- CORS is open (`allow_origins=["*"]`) in non-production environments only. Set `APP_ENV=production` to disable it.
- The HMAC dependency in `app/api/deps.py` is opt-in. Wire it to specific endpoints that need request signing.
