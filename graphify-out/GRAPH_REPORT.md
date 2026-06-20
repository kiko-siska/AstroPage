# Graph Report - /home/kristian/AstroPage  (2026-06-20)

## Corpus Check
- Corpus is ~40,940 words - fits in a single context window. You may not need a graph.

## Summary
- 655 nodes · 1070 edges · 60 communities detected
- Extraction: 70% EXTRACTED · 30% INFERRED · 0% AMBIGUOUS · INFERRED: 324 edges (avg confidence: 0.62)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_EduPage Service Layer|EduPage Service Layer]]
- [[_COMMUNITY_Auth & Login Flow|Auth & Login Flow]]
- [[_COMMUNITY_Canteen & Settings|Canteen & Settings]]
- [[_COMMUNITY_Dashboard & Timetable|Dashboard & Timetable]]
- [[_COMMUNITY_Docs & Architecture Concepts|Docs & Architecture Concepts]]
- [[_COMMUNITY_Homework & User Models|Homework & User Models]]
- [[_COMMUNITY_AI Pipeline & Dependencies|AI Pipeline & Dependencies]]
- [[_COMMUNITY_EduPage Test Helpers|EduPage Test Helpers]]
- [[_COMMUNITY_Grades Schemas|Grades Schemas]]
- [[_COMMUNITY_Grades Service|Grades Service]]
- [[_COMMUNITY_Homework Integration Tests|Homework Integration Tests]]
- [[_COMMUNITY_Gemini AI Service|Gemini AI Service]]
- [[_COMMUNITY_Brand Assets & Icons|Brand Assets & Icons]]
- [[_COMMUNITY_Substitutions PoC|Substitutions PoC]]
- [[_COMMUNITY_Canteen Order PoC|Canteen Order PoC]]
- [[_COMMUNITY_Module Group 15|Module Group 15]]
- [[_COMMUNITY_Module Group 16|Module Group 16]]
- [[_COMMUNITY_Module Group 17|Module Group 17]]
- [[_COMMUNITY_Module Group 18|Module Group 18]]
- [[_COMMUNITY_Module Group 19|Module Group 19]]
- [[_COMMUNITY_Module Group 20|Module Group 20]]
- [[_COMMUNITY_Module Group 21|Module Group 21]]
- [[_COMMUNITY_Module Group 22|Module Group 22]]
- [[_COMMUNITY_Module Group 23|Module Group 23]]
- [[_COMMUNITY_Module Group 24|Module Group 24]]
- [[_COMMUNITY_Module Group 25|Module Group 25]]
- [[_COMMUNITY_Module Group 26|Module Group 26]]
- [[_COMMUNITY_Module Group 27|Module Group 27]]
- [[_COMMUNITY_Module Group 28|Module Group 28]]
- [[_COMMUNITY_Module Group 29|Module Group 29]]
- [[_COMMUNITY_Module Group 30|Module Group 30]]
- [[_COMMUNITY_Module Group 31|Module Group 31]]
- [[_COMMUNITY_Module Group 32|Module Group 32]]
- [[_COMMUNITY_Module Group 33|Module Group 33]]
- [[_COMMUNITY_Module Group 34|Module Group 34]]
- [[_COMMUNITY_Module Group 35|Module Group 35]]
- [[_COMMUNITY_Module Group 36|Module Group 36]]
- [[_COMMUNITY_Module Group 37|Module Group 37]]
- [[_COMMUNITY_Module Group 38|Module Group 38]]
- [[_COMMUNITY_Module Group 39|Module Group 39]]
- [[_COMMUNITY_Module Group 40|Module Group 40]]
- [[_COMMUNITY_Module Group 41|Module Group 41]]
- [[_COMMUNITY_Module Group 42|Module Group 42]]
- [[_COMMUNITY_Module Group 43|Module Group 43]]
- [[_COMMUNITY_Module Group 44|Module Group 44]]
- [[_COMMUNITY_Module Group 45|Module Group 45]]
- [[_COMMUNITY_Module Group 46|Module Group 46]]
- [[_COMMUNITY_Module Group 47|Module Group 47]]
- [[_COMMUNITY_Module Group 48|Module Group 48]]
- [[_COMMUNITY_Module Group 49|Module Group 49]]
- [[_COMMUNITY_Module Group 50|Module Group 50]]
- [[_COMMUNITY_Module Group 51|Module Group 51]]
- [[_COMMUNITY_Module Group 52|Module Group 52]]
- [[_COMMUNITY_Module Group 53|Module Group 53]]
- [[_COMMUNITY_Module Group 54|Module Group 54]]
- [[_COMMUNITY_Module Group 55|Module Group 55]]
- [[_COMMUNITY_Module Group 56|Module Group 56]]
- [[_COMMUNITY_Module Group 57|Module Group 57]]
- [[_COMMUNITY_Module Group 58|Module Group 58]]
- [[_COMMUNITY_Module Group 59|Module Group 59]]

## God Nodes (most connected - your core abstractions)
1. `EduPageDataError` - 53 edges
2. `EduPageAuthError` - 18 edges
3. `User` - 18 edges
4. `AuthContext` - 16 edges
5. `list_grades()` - 14 edges
6. `PeriodOut` - 14 edges
7. `login()` - 13 edges
8. `_grade()` - 11 edges
9. `HomeworkAssignment` - 11 edges
10. `StudentGrade` - 11 edges

## Surprising Connections (you probably didn't know these)
- `handleSubmit()` --calls--> `login()`  [INFERRED]
  frontend/src/pages/Login.tsx → backend/app/api/v1/endpoints/auth.py
- `handleLogout()` --calls--> `logout()`  [INFERRED]
  frontend/src/components/AppLayout.tsx → backend/app/api/v1/endpoints/auth.py
- `generate_draft()` --calls--> `client()`  [INFERRED]
  backend/app/services/ai_service.py → backend/tests/conftest.py
- `grades_service: grouping, weighted average, and narrative filtering.` --uses--> `StudentGrade`  [INFERRED]
  backend/tests/unit/test_grades_service.py → backend/app/services/edupage_service.py
- `_closed_day()` --calls--> `MealDay`  [INFERRED]
  backend/tests/unit/test_canteen_service.py → backend/app/services/edupage_service.py

## Communities

### Community 0 - "EduPage Service Layer"
Cohesion: 0.05
Nodes (46): _change_affects_class(), EduPageAuthError, _extract_session_id(), _fetch_day_timetable(), _format_lesson_n(), get_client(), _homework_blocking(), _listok_json_blocking() (+38 more)

### Community 1 - "Auth & Login Flow"
Cohesion: 0.05
Nodes (45): handleLogout(), AuthError, login(), LoginRequest, LoginResponse, logout(), Returned on success. The JWT travels in an HttpOnly cookie, not the body., Validate credentials against the user's EduPage instance and start a session. (+37 more)

### Community 2 - "Canteen & Settings"
Cohesion: 0.08
Nodes (43): BaseModel, bulk_signup(), BulkSignupRequest, BulkSignupResponse, MealDayOut, meals(), MenuOptionOut, order() (+35 more)

### Community 3 - "Dashboard & Timetable"
Cohesion: 0.07
Nodes (31): DashboardSummary, PeriodOut, Today's timetable plus homework counts for the home-page widgets., One timetable period for the dashboard timeline., build_summary(), Aggregates EduPage data into the home-dashboard summary., summary(), fetch_timetable() (+23 more)

### Community 4 - "Docs & Architecture Concepts"
Cohesion: 0.06
Nodes (48): Backend AGENTS.md, Backend CHANGELOG, AstroPage CLAUDE.md Root Instructions, Backend CLAUDE.md (FastAPI conventions), Agents Layer (Anthropic SDK, base_agent.py), AI Homework Draft Pipeline, AstroPage — Alternative EduPage Portal, asyncio.to_thread Wrapping for edupage-api (+40 more)

### Community 5 - "Homework & User Models"
Cohesion: 0.09
Nodes (39): Shared FastAPI dependencies: HMAC verification and the EduPage session worker., Optional dependency: verify HMAC signature on signed endpoints., Authenticated request context. `edupage_session_id` is the decrypted     PHPSESS, Validate the JWT cookie and load the server-side session + user., Rehydrate a ready-to-use Edupage instance from the stored session cookie., download_attachment(), EduPageDataError, fetch_homework() (+31 more)

### Community 6 - "AI Pipeline & Dependencies"
Cohesion: 0.11
Nodes (33): AiUnavailableError, Raised when the AI provider rejects or fails the request., auth_client(), client(), FakeEdupage, Reset in-memory store and counter between tests., Sentinel standing in for an authenticated Edupage instance., TestClient with auth, EduPage client, and DB session dependencies overridden. (+25 more)

### Community 7 - "EduPage Test Helpers"
Cohesion: 0.1
Nodes (34): _collect_files(), _edu_encode_body(), _etest_files_blocking(), _format_grade_value(), _grades_blocking(), _order_blocking(), _post_order_blocking(), EduPage expects the POST body as eqap=<urlencode(base64(querystring))>&eqaz=0. (+26 more)

### Community 8 - "Grades Schemas"
Cohesion: 0.23
Nodes (19): GradeOut, GradesResponse, list_grades(), The student's weighted grades, grouped by subject.      Read-only: this powers t, All grades for one subject plus its average., One numeric grade on a subject's report card., SubjectGradesOut, _grade() (+11 more)

### Community 9 - "Grades Service"
Cohesion: 0.15
Nodes (13): fetch_grades(), StudentGrade, list_grades(), _points_percentage(), Grade grouping and weighted-average computation.  EduPage returns a flat list of, Σ(value × weight) / Σ(weight) over numeric grades with positive weight., Σ(earned) / Σ(max) × 100 over points grades.      Mirrors EduPage's points scori, Return (average, is_points) for one subject.      A subject is points-based as s (+5 more)

### Community 10 - "Homework Integration Tests"
Cohesion: 0.12
Nodes (1): _hw()

### Community 11 - "Gemini AI Service"
Cohesion: 0.17
Nodes (13): build_system_prompt(), _fallback_draft(), generate_draft(), AI homework draft generation using Google Gemini.  Accepts the assignment text a, The student's custom rules go first; the study-assistant constraint is     alway, Deterministic offline draft so the flow works without an API key., Generate a markdown homework draft.      attachments: list of (file_bytes, mime_, _text_prompt() (+5 more)

### Community 12 - "Brand Assets & Icons"
Cohesion: 0.17
Nodes (16): AstroPage Brand Identity, Bluesky Social Icon, Discord Icon, Documentation Icon (Book/Code), AstroPage Favicon (Lightning Bolt Icon), Frontend Assets Directory, Frontend Public Directory, GitHub Icon (+8 more)

### Community 13 - "Substitutions PoC"
Cohesion: 0.27
Nodes (11): change_affects_class(), format_lesson_n(), get_credentials(), main(), parse_date(), print_missing_teachers(), print_timetable_changes(), `lesson_n` is an int period, or a (from, to) tuple for a span. (+3 more)

### Community 14 - "Canteen Order PoC"
Cohesion: 0.26
Nodes (11): fetch_listok(), get_credentials(), main(), ordered_letter(), parse_choice(), parse_date(), post_order(), POST the order/sign-off — the same `ulozJedlaStravnika` action the lib uses. (+3 more)

### Community 15 - "Module Group 15"
Cohesion: 0.18
Nodes (6): configure_logging(), lifespan(), get_session(), init_db(), Create tables from SQLModel metadata. Called from the app lifespan.      Fine fo, FastAPI dependency yielding an async DB session.

### Community 16 - "Module Group 16"
Cohesion: 0.22
Nodes (7): BaseAgent, Base agentic loop: tool-use → observation → next step, until stop_reason == "end, Minimal agent that runs an agentic loop with tool use., build_calculator_agent(), _eval(), handle_calculate(), Example: a calculator agent that uses a tool to evaluate math expressions.  Run:

### Community 17 - "Module Group 17"
Cohesion: 0.2
Nodes (1): test_bulk_signup_returns_summary()

### Community 18 - "Module Group 18"
Cohesion: 0.44
Nodes (7): classicNumeric(), classicTone(), gradePercent(), isAbsent(), liveAverage(), percentTone(), toneFor()

### Community 19 - "Module Group 19"
Cohesion: 0.39
Nodes (7): changeMeal(), groupByWeek(), markPending(), parseDay(), setOrdered(), weekKey(), weekLabel()

### Community 20 - "Module Group 20"
Cohesion: 0.25
Nodes (3): cachedFetch(), peekCache(), prefetchAll()

### Community 21 - "Module Group 21"
Cohesion: 0.22
Nodes (0): 

### Community 22 - "Module Group 22"
Cohesion: 0.29
Nodes (2): parseDay(), weekRangeLabel()

### Community 23 - "Module Group 23"
Cohesion: 0.25
Nodes (2): Item, create_item()

### Community 24 - "Module Group 24"
Cohesion: 0.29
Nodes (0): 

### Community 25 - "Module Group 25"
Cohesion: 0.33
Nodes (2): getHomeworkStatus(), hoursUntil()

### Community 26 - "Module Group 26"
Cohesion: 0.33
Nodes (0): 

### Community 27 - "Module Group 27"
Cohesion: 0.33
Nodes (1): AI-prompt settings endpoints — hermetic (DB session mocked in conftest).

### Community 28 - "Module Group 28"
Cohesion: 0.33
Nodes (0): 

### Community 29 - "Module Group 29"
Cohesion: 0.4
Nodes (0): 

### Community 30 - "Module Group 30"
Cohesion: 0.5
Nodes (2): BaseSettings, Settings

### Community 31 - "Module Group 31"
Cohesion: 0.67
Nodes (0): 

### Community 32 - "Module Group 32"
Cohesion: 0.67
Nodes (0): 

### Community 33 - "Module Group 33"
Cohesion: 0.67
Nodes (0): 

### Community 34 - "Module Group 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Module Group 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Module Group 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Module Group 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Module Group 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Module Group 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Module Group 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Module Group 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Module Group 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Module Group 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Module Group 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Module Group 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Module Group 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Module Group 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Module Group 48"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Module Group 49"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Module Group 50"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Module Group 51"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Module Group 52"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Module Group 53"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Module Group 54"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Module Group 55"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Module Group 56"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Module Group 57"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Module Group 58"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Module Group 59"
Cohesion: 1.0
Nodes (1): Backend Security Policy

## Knowledge Gaps
- **84 isolated node(s):** `Manual smoke check: log in to a real EduPage account and print the homework that`, `Build a minimal EduStudent for the logged-in user, or None for non-students.`, `Prefer the canonical per-date endpoint; fall back to the dashboard plan.`, `The logged-in student's class name (e.g. "II.D"), or None if undetermined.`, `True when a timetable change is for `my_class`.      Matches a direct per-class` (+79 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Module Group 34`** (2 nodes): `translations.ts`, `pluralCategory()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Group 35`** (2 nodes): `Settings.tsx`, `handleSave()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Group 36`** (2 nodes): `RefreshButton.tsx`, `agoLabel()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Group 37`** (2 nodes): `useCachedResource.ts`, `useCachedResource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Group 38`** (2 nodes): `test_health.py`, `test_health_returns_ok()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Group 39`** (1 nodes): `postcss.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Group 40`** (1 nodes): `eslint.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Group 41`** (1 nodes): `vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Group 42`** (1 nodes): `ErrorPage.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Group 43`** (1 nodes): `LanguageSwitcher.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Group 44`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Group 45`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Group 46`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Group 47`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Group 48`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Group 49`** (1 nodes): `rate_limit.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Group 50`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Group 51`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Group 52`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Group 53`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Group 54`** (1 nodes): `router.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Group 55`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Group 56`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Group 57`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Group 58`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Group 59`** (1 nodes): `Backend Security Policy`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `EduPageDataError` connect `Homework & User Models` to `EduPage Service Layer`, `Canteen & Settings`, `Dashboard & Timetable`, `AI Pipeline & Dependencies`, `EduPage Test Helpers`, `Grades Schemas`, `Grades Service`?**
  _High betweenness centrality (0.202) - this node is a cross-community bridge._
- **Why does `login()` connect `Auth & Login Flow` to `Substitutions PoC`, `Canteen Order PoC`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Why does `EduPageAuthError` connect `EduPage Service Layer` to `Auth & Login Flow`, `Homework & User Models`, `AI Pipeline & Dependencies`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Are the 37 inferred relationships involving `EduPageDataError` (e.g. with `canteen_service: weekday window computation + bulk sign-up engine.` and `edupage_service: e-test attachment parsing (no network).`) actually correct?**
  _`EduPageDataError` has 37 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `EduPageAuthError` (e.g. with `Hermetic auth-endpoint tests: no live Postgres or EduPage required.  The DB depe` and `A subdomain that isn't a valid DNS label is rejected before any network call.`) actually correct?**
  _`EduPageAuthError` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 15 inferred relationships involving `User` (e.g. with `Homework listing and AI draft orchestration.` and `August 1st of the current academic year — the window we fetch homework     over`) actually correct?**
  _`User` has 15 INFERRED edges - model-reasoned connections that need verification._
- **Are the 13 inferred relationships involving `AuthContext` (e.g. with `FakeEdupage` and `Reset in-memory store and counter between tests.`) actually correct?**
  _`AuthContext` has 13 INFERRED edges - model-reasoned connections that need verification._