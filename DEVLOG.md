# AstroPage — Devlog

A running log of how AstroPage came together. AstroPage is a faster, nicer
alternative portal for EduPage (a school platform): students log in with their
EduPage credentials and school subdomain, the backend authenticates against
their school's instance and proxies the data, and an AI assistant drafts
homework solutions for the student to review — nothing is ever auto-submitted.

Stack: **FastAPI** (async, `uv`) + **React/Vite/TypeScript**, Postgres for
sessions, Docker Compose for the whole thing.

---

## 2026-06-11 — Foundations

Set up the monorepo: `backend/` (FastAPI) and `frontend/` (React + Vite +
Tailwind), wired together with a root `Makefile` and `docker-compose.yml`.

The first real decision was the **auth model**. We're a client portal, not an
identity provider, so the rule from day one: **never store passwords.** The
password is used once at login and discarded. What we keep is the EduPage
`PHPSESSID`, Fernet-encrypted at rest in Postgres, with a JWT handed to the
browser in an HttpOnly cookie. Protected endpoints rehydrate an EduPage client
from the stored session on each request.

## 2026-06-12 — Login against EduPage

Built the login slice end to end. The `edupage-api` library is synchronous
(`requests` under the hood), so every call gets wrapped in `asyncio.to_thread`
to keep the event loop free — this becomes a recurring pattern across every
service.

The library parses EduPage's HTML/JSON **positionally**, so when a page isn't
what it expects (wrong subdomain → a 404 login page, etc.) it throws
`IndexError`/`KeyError` from deep inside. Spent time mapping all of those to
clean, client-safe errors (`bad_credentials`, `captcha`, `two_factor_required`,
`unreachable`) instead of letting them surface as 500s. Lesson: treat the whole
library as a flaky scraper, never as an API.

## 2026-06-15 — Feature slices land

A big day. Added four resource slices following the strict model → schema →
service → endpoint → tests order: **dashboard**, **homework**, **canteen**,
and **settings**.

The homework feature is where EduPage fought back hardest:

- **E-test attachments.** Homework that links an e-test doesn't carry its files
  on the timeline event — they live inside the e-test material, reachable only
  through the `EtestCreator` endpoint and keyed by a `superid`. Had to
  reverse-engineer EduPage's `eqap=base64(querystring)` POST body encoding and
  recursively walk the card widgets to pull `{name, src}` files out.

- **Mark-as-done.** This took three commits to get right. The timeline
  `homeworkFlag` action *looks* like it works with the plain timeline id —
  EduPage returns a cheerful 200 and applies nothing. The id has to be in the
  form `superid:<n>`. So now we don't trust the 200: we read `doneMaxCas` back
  out of the returned `timelineUserProps` and confirm the change actually
  persisted. Verified live against a real account.

The theme of the day: **EduPage lies with 200s.** Every write gets read back
and verified.

## 2026-06-17 — Grades, design, and the timetable saga

**Grades.** EduPage grades are 1–5 (1 best), each with an "importance" weight,
plus points-based grades (`14.75/15`) that the library leaves as strings. Parsed
both, surfaced raw weight points so the frontend can recompute weighted averages
itself, and handled the "absent" mark so it correctly drags the average down
until the test is made up.

**Design pass.** Reshaped the frontend into its current look — a dark, copper-on-
near-black aesthetic with Cormorant Garamond / Inter / JetBrains Mono. Sidebar
nav now fully i18n-ready.

**The timetable bug.** Shipped the timetable (Rozvrh) feature, then hit the most
interesting bug of the project: *some weekdays loaded, others were silently
blank.* Root cause: `get_my_timetable()` reads EduPage's **dashboard per-day
plan** (`eb.php`/`gcall`), which raises `MissingDataException` for any day the
response didn't happen to include — so individual days dropped out at random
while their neighbours were fine.

Fix: switch to the canonical **`currenttt.js`** timetable endpoint
(`get_timetable(student, day)`), which takes an explicit date and returns data
consistently, keeping the old dashboard call only as a fallback. Resolved the
logged-in student from their EduPage user id to address that endpoint. Also made
failures *loud* — when a day can't be fetched we now log the full exception and
traceback, so a blank day is diagnosable straight from the console/`docker logs`
instead of being reduced to an exception class name.

The week build already degrades per-day (one failed day never blanks the whole
week), so this layered cleanly on top.

**Presentation branch.** Branched `presentation` and hid the pages that aren't
100% yet (Dashboard, Rozvrh, Jedáleň, Domáce úlohy), leaving Známky and
Nastavenia, so a demo only shows what's solid.

## 2026-06-18 — Toward deployment

Turning attention to running this on a home server. The repo already had the
container story (`docker-compose.yml`: Postgres + backend + nginx-served
frontend proxying `/api` same-origin) and a CI workflow (ruff + pytest on
push/PR). Designed the CD half: a **self-hosted GitHub Actions runner** on the
home server that, on push to `main`, syncs a persistent clone (where the
gitignored `.env` secrets live) and runs `docker compose up -d --build` with a
`/health` gate. No registry, no inbound ports — the runner polls GitHub
outbound. LAN-only access against the compose Postgres.

## 2026-06-19 — i18n, background prefetch, and real AI

Three features landed in one session:

**Background prefetch on login.** After a successful login, `prefetchAll()` fires
as a background promise (fire-and-forget, never blocks the login transition) and
sequentially warms every page's cache in priority order: `dashboard` first (the
landing page), then `timetable`, `homework`, `grades`, `canteen`. Each task
swallows its own error so one failing EduPage resource doesn't block the others.
The cache keys in `prefetch.ts` are intentionally identical to the keys each
page passes to `useCachedResource`, so navigating to any tab after login is an
instant cache hit. New file: `frontend/src/api/prefetch.ts`.

**Full EN/SK internationalisation (English default).** Ripped out every hardcoded
Slovak string across all pages and components and replaced them with `t(key)`
calls backed by a flat translation catalogue in `frontend/src/i18n/translations.ts`.
Key design decisions:

- `LanguageContext` provides `t(key, vars?)` for string substitution and
  `tn(key, n, vars?)` for pluralisation (SK uses a 3-form system: 1=one, 2–4=few,
  else=other; EN uses 2-form standard). A `locale` string (`en-GB` / `sk-SK`) is
  also provided for `Intl` date/number formatting.
- Language defaults to `"en"` and persists to `localStorage` under
  `astropage.lang`. Switching language is instant — no page reload.
- `LanguageSwitcher` component (EN/SK toggle) appears in the sidebar footer and
  the login card.
- `LanguageProvider` wraps the whole app in `App.tsx`, so `useT()` is available
  everywhere.
- React 19's `react-hooks/purity` rule flagged `Date.now()` in `RefreshButton`
  as an impure call during render — fixed by lifting `agoLabel()` to module scope
  and threading `t` as a parameter.

**AI homework wired to Gemini.** The `runAi` function in `Homework.tsx` now calls
`api.generateAiDraft(hw.id)` instead of a local mock. The backend
(`ai_service.py`) uses `gemini-2.5-flash`, sends all attachment bytes (PDFs,
images, text, ≤20 MB each) as inline Gemini parts along with the assignment text
and the student's custom prompt prefix, and always appends the
`STUDY_ASSISTANT_CONSTRAINT` so the model cannot be instructed to just produce a
final answer. The frontend added an `error` phase to `AiState` with a visible
error panel and retry button. The AI model was bumped from `gemini-2.0-flash`
(now 404) to `gemini-2.5-flash`.

---

## Known issues / next up

- **Land CD.** The `cd.yml` deploy workflow is written; register the self-hosted
  runner and do the first automated deploy to the home server.
- **Finish the hidden pages.** Dashboard, Rozvrh, Jedáleň and Domáce úlohy need
  to reach "demo-ready" and come back into the nav.
- **Persist AI settings.** The Settings page saves rules to component state only;
  they need to round-trip through the backend so they survive a refresh and are
  available to the AI endpoint.

## Principles that have held up

- **Never store passwords; never auto-submit to EduPage.** Human-in-the-loop is
  a product constraint, not a nice-to-have.
- **Treat `edupage-api` as a flaky scraper.** Wrap every call in a thread, map
  its positional-parse failures to clean errors, and verify every write by
  reading it back — EduPage will hand you a 200 for a no-op.
- **Degrade per-unit, log loudly.** One failed day/meal/grade shouldn't blank
  the view, and when something fails the real reason belongs in the logs.
- **Cache early, cache smart.** The session cache (`useCachedResource`) provides
  instant re-renders on tab switches and background refresh on TTL expiry. The
  prefetch on login means the first tab switch is almost always served from cache.
