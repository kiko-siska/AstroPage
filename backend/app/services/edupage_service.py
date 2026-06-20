"""Thin async wrapper around the synchronous `edupage-api` library.

Every call into edupage-api uses `requests` under the hood and blocks, so we run
it in a worker thread via `asyncio.to_thread` to avoid stalling the event loop.
"""

import asyncio
import base64
import json
import logging
import re
import urllib.parse
from dataclasses import dataclass
from datetime import date, datetime

import requests
from edupage_api import Edupage
from edupage_api.exceptions import (
    BadCredentialsException,
    CaptchaException,
)
from edupage_api.people import EduStudent
from edupage_api.substitution import Action

logger = logging.getLogger("app.edupage")


class EduPageAuthError(Exception):
    """Raised when EduPage rejects the login. `reason` is a stable, client-safe code."""

    def __init__(self, reason: str, message: str):
        self.reason = reason
        self.message = message
        super().__init__(message)


class EduPageDataError(Exception):
    """Raised when an authenticated EduPage data fetch fails. `reason` is a stable,
    client-safe code; the raw library error is logged, never surfaced."""

    def __init__(self, reason: str, message: str):
        self.reason = reason
        self.message = message
        super().__init__(message)


def _extract_session_id(edupage: Edupage) -> str:
    """Pull the PHPSESSID cookie out of the authenticated requests session."""
    for cookie in edupage.session.cookies:
        if cookie.name == "PHPSESSID":
            return cookie.value
    raise EduPageAuthError("no_session", "Login succeeded but no session cookie was returned.")


def _login_blocking(username: str, password: str, subdomain: str) -> str:
    edupage = Edupage()
    # Returns a TwoFactorLogin object when 2FA is enabled, else None.
    two_factor = edupage.login(username, password, subdomain)
    if two_factor is not None:
        raise EduPageAuthError(
            "two_factor_required",
            "This account uses two-factor authentication, which isn't supported yet.",
        )
    return _extract_session_id(edupage)


async def login(username: str, password: str, subdomain: str) -> str:
    """Authenticate against `{subdomain}.edupage.org` and return the PHPSESSID.

    The password exists only for the duration of this call and is never returned,
    stored, or logged. Raises EduPageAuthError on any failure.
    """
    try:
        return await asyncio.to_thread(_login_blocking, username, password, subdomain)
    except EduPageAuthError:
        raise  # already a clean, client-safe error (2FA, no session)
    except BadCredentialsException:
        raise EduPageAuthError("bad_credentials", "Invalid username, password, or school domain.")
    except CaptchaException:
        raise EduPageAuthError(
            "captcha", "EduPage requires a captcha. Please log in directly on EduPage and retry."
        )
    except requests.RequestException as exc:
        # DNS failure, timeout, connection refused — usually a wrong/dead subdomain.
        logger.info("edupage unreachable: subdomain=%s err=%s", subdomain, type(exc).__name__)
        raise EduPageAuthError(
            "unreachable",
            "Could not reach EduPage for that school domain. Check the domain and try again.",
        )
    except Exception as exc:
        # edupage-api parses HTML/JSON positionally and raises IndexError/KeyError/etc.
        # when the page isn't the expected login page (e.g. a 404 for a non-existent
        # subdomain). Map all of these to one clean error instead of a 500.
        logger.warning(
            "edupage login parse/unexpected error: subdomain=%s err=%s",
            subdomain,
            type(exc).__name__,
        )
        raise EduPageAuthError(
            "login_failed",
            "Login failed. Double-check your school domain, username, and password.",
        )


def _verify_blocking(session_id: str, subdomain: str, username: str) -> bool:
    try:
        Edupage.from_session_id(session_id, subdomain, username)
        return True
    except BadCredentialsException:
        return False


async def session_is_valid(session_id: str, subdomain: str, username: str) -> bool:
    """Check whether a stored PHPSESSID still authenticates against EduPage."""
    return await asyncio.to_thread(_verify_blocking, session_id, subdomain, username)


# ── Session rehydration ───────────────────────────────────────────────────────


def _rehydrate_blocking(session_id: str, subdomain: str, username: str) -> Edupage:
    return Edupage.from_session_id(session_id, subdomain, username)


async def get_client(session_id: str, subdomain: str, username: str) -> Edupage:
    """Rebuild an authenticated Edupage instance from a stored PHPSESSID.

    Raises EduPageAuthError("session_expired") when EduPage no longer accepts it.
    """
    try:
        return await asyncio.to_thread(_rehydrate_blocking, session_id, subdomain, username)
    except BadCredentialsException:
        raise EduPageAuthError(
            "session_expired", "Your EduPage session has expired. Please log in again."
        )
    except requests.RequestException as exc:
        logger.info(
            "edupage unreachable on rehydrate: subdomain=%s err=%s", subdomain, type(exc).__name__
        )
        raise EduPageDataError("unreachable", "Could not reach EduPage. Please try again.")
    except Exception as exc:
        logger.warning(
            "edupage rehydrate error: subdomain=%s err=%s", subdomain, type(exc).__name__
        )
        raise EduPageAuthError(
            "session_expired", "Your EduPage session is no longer valid. Please log in again."
        )


# ── Data fetchers ─────────────────────────────────────────────────────────────
# Each returns plain dataclasses fully materialised inside the worker thread so
# no lazy edupage-api state is touched from the event loop.


@dataclass
class TimetablePeriod:
    period: int | None
    start: str
    end: str
    subject: str
    classroom: str | None
    teacher: str | None
    is_cancelled: bool
    curriculum: str | None


def _resolve_self_student(edupage: Edupage) -> EduStudent | None:
    """Build an `EduStudent` for the logged-in user from their EduPage user id.

    `get_user_id()` returns e.g. "Student12345"; `get_timetable` only reads
    `target.person_id`, so a minimal student carrying just the parsed id is
    enough to address the `currenttt.js` endpoint. Returns None for non-student
    accounts (teacher/parent) whose user id has no numeric student part.
    """
    user_id = edupage.get_user_id() or ""
    if not user_id.startswith("Student"):
        return None
    digits = "".join(c for c in user_id if c.isdigit())
    if not digits:
        return None
    # Only person_id is used downstream; the rest are placeholders.
    return EduStudent(
        person_id=int(digits),
        name="",
        gender=None,
        in_school_since=None,
        class_id=0,
        number_in_class=0,
    )


def _fetch_day_timetable(edupage: Edupage, day: date):
    """Fetch one day's `Timetable`, preferring the endpoint that works for students.

    `get_my_timetable` reads the student's *personalised* dashboard day-plan
    (`eb.php`/`gcall`) and is the source of truth for a student's own lessons and
    cancellations. The `currenttt.js` endpoint (`get_timetable`) is a school-wide
    timetable view that needs teacher/admin rights — on a student account it
    always raises `InsufficientPermissionsException`. So we try the personal plan
    first and only fall back to `currenttt` for days the dashboard omits (it
    raises `MissingDataException` for those). Both attempts log at debug, never
    warning: the first failing while the second succeeds is normal operation, not
    an error worth surfacing.
    """
    try:
        timetable = edupage.get_my_timetable(day)
        if timetable and timetable.lessons:
            return timetable
    except Exception as exc:
        logger.debug("dashboard day-plan unavailable for %s: %r", day, exc)

    student = _resolve_self_student(edupage)
    if student is not None:
        try:
            return edupage.get_timetable(student, day)
        except Exception as exc:
            logger.debug("currenttt timetable unavailable for %s: %r", day, exc)
    return None


def _timetable_blocking(edupage: Edupage, day: date) -> list[TimetablePeriod]:
    timetable = _fetch_day_timetable(edupage, day)
    periods: list[TimetablePeriod] = []
    for lesson in timetable.lessons if timetable else []:
        periods.append(
            TimetablePeriod(
                period=lesson.period,
                # All-day "event" lessons (school events) carry no start/end time.
                start=lesson.start_time.strftime("%H:%M") if lesson.start_time else "",
                end=lesson.end_time.strftime("%H:%M") if lesson.end_time else "",
                subject=lesson.subject.name if lesson.subject else "—",
                classroom=lesson.classrooms[0].name if lesson.classrooms else None,
                teacher=lesson.teachers[0].name if lesson.teachers else None,
                is_cancelled=lesson.is_cancelled,
                curriculum=lesson.curriculum,
            )
        )
    return periods


async def fetch_timetable(edupage: Edupage, day: date) -> list[TimetablePeriod]:
    try:
        return await asyncio.to_thread(_timetable_blocking, edupage, day)
    except Exception as exc:
        # Log the full error + traceback so a failing day is diagnosable from the
        # console (web/docker logs), not just reduced to an exception class name.
        logger.warning("timetable fetch failed for %s: %r", day, exc, exc_info=True)
        raise EduPageDataError("timetable_failed", "Could not load the timetable from EduPage.")


# ── Substitutions (timetable changes) ─────────────────────────────────────────


@dataclass
class TimetableChange:
    """One substitution affecting a class: a cancellation, room/teacher swap, etc.

    `lesson` is the period number ("3"), a span ("4–5"), or "" for all-day items.
    `action` is "add" | "change" | "remove" | None (None for calendar entries).
    """

    lesson: str
    change_class: str
    title: str
    action: str | None


def _resolve_self_class(edupage: Edupage) -> str | None:
    """The logged-in student's class name (e.g. "II.D"), or None if undetermined.

    EduPage stores the user's class id in `userrow.TriedaID`; we map it to the
    class name via `get_classes()` so it matches the substitution viewer's
    `change_class` strings.
    """
    userrow = (edupage.data or {}).get("userrow") or {}
    trieda_id = userrow.get("TriedaID")
    if trieda_id is None:
        return None
    try:
        class_id = int(trieda_id)
    except (TypeError, ValueError):
        return None
    for edu_class in edupage.get_classes() or []:
        if edu_class.class_id == class_id:
            return edu_class.name
    return None


def _format_lesson_n(lesson_n: object) -> str:
    """A `TimetableChange.lesson_n` (int period, or (from, to) span) as a string."""
    if isinstance(lesson_n, tuple):
        return f"{lesson_n[0]}–{lesson_n[1]}"
    return "" if lesson_n is None else str(lesson_n)


def _change_affects_class(change, my_class: str) -> bool:
    """True when a change is for `my_class` — directly, or as a whole-school /
    calendar entry whose title lists the class. Class names are matched as whole
    tokens so "I.D" never matches "II.D"."""
    if change.change_class == my_class:
        return True
    tokens = re.split(r"[,:;()]\s*|\s+", change.title or "")
    return my_class in tokens


def _timetable_changes_blocking(edupage: Edupage, day: date) -> list[TimetableChange]:
    my_class = _resolve_self_class(edupage)
    changes = edupage.get_timetable_changes(day) or []
    out: list[TimetableChange] = []
    for change in changes:
        if my_class and not _change_affects_class(change, my_class):
            continue
        action = change.action.value if isinstance(change.action, Action) else None
        out.append(
            TimetableChange(
                lesson=_format_lesson_n(change.lesson_n),
                change_class=change.change_class,
                title=(change.title or "").strip(),
                action=action,
            )
        )
    return out


async def fetch_timetable_changes(edupage: Edupage, day: date) -> list[TimetableChange]:
    """Substitutions (cancellations, room/teacher swaps) for the logged-in
    student's class on `day`.

    Returns [] when there are none, the class can't be resolved, or the scrape
    fails — a substitution failure must never blank the base timetable.
    """
    try:
        return await asyncio.to_thread(_timetable_changes_blocking, edupage, day)
    except Exception as exc:
        logger.warning("timetable changes fetch failed for %s: %r", day, exc, exc_info=True)
        return []


@dataclass
class HomeworkAssignment:
    id: str
    subject: str | None
    title: str
    description: str
    teacher: str | None
    assigned_at: datetime | None
    due_date: datetime | None
    is_done: bool
    # Homework whose attachments live in a linked e-test rather than the
    # timeline event. `superid` addresses that e-test; kept server-side only.
    has_attachments: bool = False
    superid: str | None = None


@dataclass
class HomeworkAttachment:
    name: str
    url: str
    type: str | None
    extension: str | None


def _parse_due_date(data: dict) -> datetime | None:
    raw = data.get("date") or data.get("datetimeto")
    if not raw:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(raw), fmt)
        except ValueError:
            continue
    return None


def _homework_blocking(edupage: Edupage, since: date | None = None) -> list[HomeworkAssignment]:
    from edupage_api.dbi import DbiHelper
    from edupage_api.timeline import EventType

    # `get_notifications` only returns the small login-cached timeline window
    # (~the last couple of weeks). For a fuller backlog, pull the history since
    # `since` instead — EduPage's history endpoint reaches back months.
    events = edupage.get_notification_history(since) if since else edupage.get_notifications()

    assignments: list[HomeworkAssignment] = []
    for event in events:
        if event.event_type != EventType.HOMEWORK:
            continue
        data = event.additional_data or {}

        subject = None
        subject_id = data.get("predmetid")
        if subject_id:
            try:
                subject = DbiHelper(edupage).fetch_subject_name(int(subject_id))
            except (ValueError, TypeError, KeyError):
                subject = None

        title = data.get("nazov") or (event.text or "").split("\n")[0] or "Homework"
        teacher = (
            event.author if isinstance(event.author, str) else getattr(event.author, "name", None)
        )

        # Homework that links an e-test carries the attachments inside that
        # e-test (keyed by `superid`), not on the timeline event itself.
        superid = data.get("superid")
        superid = str(superid) if superid else None
        has_etest = bool(data.get("etestCards") or data.get("etestcards"))

        assignments.append(
            HomeworkAssignment(
                id=str(event.event_id),
                subject=subject,
                title=str(title),
                description=event.text or "",
                teacher=teacher,
                assigned_at=event.timestamp,
                due_date=_parse_due_date(data),
                is_done=event.is_done,
                has_attachments=has_etest and superid is not None,
                superid=superid,
            )
        )
    return assignments


async def fetch_homework(edupage: Edupage, since: date | None = None) -> list[HomeworkAssignment]:
    try:
        return await asyncio.to_thread(_homework_blocking, edupage, since)
    except Exception as exc:
        logger.warning("homework fetch failed: err=%s", type(exc).__name__)
        raise EduPageDataError("homework_failed", "Could not load homework from EduPage.")


# ── E-test attachments ────────────────────────────────────────────────────────
# Homework that links an e-test stores its files inside the e-test material,
# reachable only via the EtestCreator endpoint — not on the timeline event.


def _edu_encode_body(data: dict[str, str]) -> str:
    """EduPage expects the POST body as eqap=<urlencode(base64(querystring))>&eqaz=0."""
    query = urllib.parse.urlencode(data)
    b64 = base64.b64encode(query.encode("utf-8")).decode("ascii")
    return f"eqap={urllib.parse.quote(b64)}&eqaz=0"


def _collect_files(node: object, subdomain: str, out: list[HomeworkAttachment]) -> None:
    """Recursively pull every {name, src} file out of e-test card widgets
    (FileETestWidget / ImageETestWidget store them under props.files[])."""
    if isinstance(node, dict):
        props = node.get("props")
        files = props.get("files") if isinstance(props, dict) else None
        if isinstance(files, list):
            for f in files:
                if isinstance(f, dict) and f.get("src"):
                    src = str(f["src"])
                    out.append(
                        HomeworkAttachment(
                            name=f.get("name") or src.rsplit("/", 1)[-1],
                            url=f"https://{subdomain}.edupage.org{src}",
                            type=f.get("type"),
                            extension=f.get("extension"),
                        )
                    )
        for value in node.values():
            _collect_files(value, subdomain, out)
    elif isinstance(node, list):
        for value in node:
            _collect_files(value, subdomain, out)


def _etest_files_blocking(edupage: Edupage, superid: str) -> list[HomeworkAttachment]:
    url = (
        f"https://{edupage.subdomain}.edupage.org/elearning/?cmd=EtestCreator&akcia=getResultsData"
    )
    headers = {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": f"https://{edupage.subdomain}.edupage.org/",
    }
    resp = edupage.session.post(
        url, data=_edu_encode_body({"superid": str(superid)}), headers=headers
    )
    resp.raise_for_status()
    cards = resp.json().get("materialData", {}).get("cardsData", {})

    found: list[HomeworkAttachment] = []
    for card in cards.values():
        content = card.get("content")
        if isinstance(content, str):
            try:
                content = json.loads(content)
            except json.JSONDecodeError:
                continue
        _collect_files(content, edupage.subdomain, found)

    # De-duplicate by url, preserving order.
    seen: set[str] = set()
    unique: list[HomeworkAttachment] = []
    for f in found:
        if f.url not in seen:
            seen.add(f.url)
            unique.append(f)
    return unique


async def fetch_homework_attachments(edupage: Edupage, superid: str) -> list[HomeworkAttachment]:
    """Files attached to the e-test cards of the homework addressed by `superid`."""
    try:
        return await asyncio.to_thread(_etest_files_blocking, edupage, superid)
    except Exception as exc:
        logger.warning("etest attachments fetch failed: err=%s", type(exc).__name__)
        raise EduPageDataError(
            "attachments_failed", "Could not load homework attachments from EduPage."
        )


def _download_attachment_blocking(edupage: Edupage, url: str) -> tuple[bytes, str]:
    resp = edupage.session.get(url, timeout=30)
    resp.raise_for_status()
    mime = resp.headers.get("content-type", "application/octet-stream").split(";")[0].strip()
    return resp.content, mime


async def download_attachment(edupage: Edupage, url: str) -> tuple[bytes, str]:
    """Download a homework attachment and return (bytes, mime_type).
    Raises EduPageDataError on failure."""
    try:
        return await asyncio.to_thread(_download_attachment_blocking, edupage, url)
    except Exception as exc:
        logger.warning("attachment download failed: url=%s err=%s", url, type(exc).__name__)
        raise EduPageDataError("attachment_failed", "Could not download attachment.")


# ── Homework done state ───────────────────────────────────────────────────────


def _set_homework_done_blocking(
    edupage: Edupage, superid: str, timelineid: str, done: bool
) -> None:
    """Toggle the student's "done" flag on a homework via the timeline
    "homeworkFlag" action.

    The body uses the same eqap base64 encoding as the e-test endpoint. The
    `homeworkid` must be the homework's own id in the form ``superid:<n>`` — the
    plain timeline id does NOT work (EduPage accepts it but applies nothing).
    Verified live against a real account.

    EduPage echoes the full timeline back; we confirm the change actually took by
    reading `doneMaxCas` for this timeline item out of the returned
    `timelineUserProps`, rather than trusting a generic 200.
    """
    url = f"https://{edupage.subdomain}.edupage.org/timeline/?akcia=homeworkFlag"
    headers = {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": f"https://{edupage.subdomain}.edupage.org/",
    }
    payload = {
        "homeworkid": f"superid:{superid}",
        "flag": "done",
        "value": "1" if done else "0",
    }
    resp = edupage.session.post(url, data=_edu_encode_body(payload), headers=headers)
    resp.raise_for_status()
    user_props = resp.json().get("timelineUserProps")
    if not isinstance(user_props, dict):
        raise EduPageDataError("done_failed", "EduPage refused to update the homework state.")

    is_done_now = bool(user_props.get(str(timelineid), {}).get("doneMaxCas"))
    if is_done_now != done:
        raise EduPageDataError("done_failed", "EduPage did not apply the homework change.")


async def set_homework_done(edupage: Edupage, superid: str, timelineid: str, done: bool) -> None:
    """Mark a homework as done / not done on EduPage and confirm it applied."""
    try:
        await asyncio.to_thread(_set_homework_done_blocking, edupage, superid, timelineid, done)
    except EduPageDataError:
        raise
    except Exception as exc:
        logger.warning("homework done toggle failed: err=%s", type(exc).__name__)
        raise EduPageDataError("done_failed", "Could not update the homework state on EduPage.")


# ── Grades ────────────────────────────────────────────────────────────────────
# EduPage grades are 1 (best) – 5 (worst). Each carries an "importance" factor
# (the library's `importance` = EduPage's raw weight / 20); we surface the raw
# weight points so the frontend sandbox can recompute weighted averages itself.


@dataclass
class StudentGrade:
    id: str
    subject_name: str
    # Display value as shown on EduPage. For classic grades this is "1".."5";
    # for points grades it's the earned points (e.g. "10"), paired with
    # max_points below so the client can render "10/10".
    value: str
    # Numeric grade for averaging, or None for verbal / non-numeric entries.
    # For points grades this holds the earned points.
    numeric_value: float | None
    # EduPage weight points (importance * 20); 20 == a normal-weight grade.
    weight: int
    description: str
    date: date | None
    # Max points for a points/percentage grade (e.g. 10 for "5/10"); None for
    # classic 1–5 grades. Its presence is what marks a grade as points-based.
    max_points: float | None = None


def _format_grade_value(grade_n: object) -> str:
    """EduPage returns whole grades as floats (1.0); render them without the
    trailing ".0" while leaving genuine decimals and verbal text intact."""
    if isinstance(grade_n, float) and grade_n.is_integer():
        return str(int(grade_n))
    return str(grade_n)


def _grades_blocking(edupage: Edupage) -> list[StudentGrade]:
    grades: list[StudentGrade] = []
    for grade in edupage.get_grades():
        if grade.subject_name is None:
            continue

        # `importance` is None for points-only grades; treat a missing factor as
        # the default normal weight so they still participate in the average.
        importance = grade.importance if grade.importance is not None else 1.0
        weight = round(importance * 20)

        display = _format_grade_value(grade.grade_n)
        numeric: float | None = None
        if not grade.verbal:
            if isinstance(grade.grade_n, (int, float)):
                numeric = float(grade.grade_n)
            else:
                # EduPage leaves partial/decimal grades like "14.75" as strings
                # (str.isdigit() rejects the dot), which would otherwise be
                # dropped. Parse them so e.g. 14.75/15 is counted.
                try:
                    numeric = float(str(grade.grade_n).replace(",", "."))
                except (TypeError, ValueError):
                    numeric = None
        if numeric is None and display.strip().upper() == "A":
            # EduPage's "absent" mark, counted (not dropped) so it drags the
            # average down until the test is made up: 0 earned points in a
            # points subject, or a 5 on the classic 1–5 scale.
            numeric = 0.0 if grade.max_points is not None else 5.0

        grades.append(
            StudentGrade(
                id=str(grade.event_id),
                subject_name=grade.subject_name,
                value=display,
                numeric_value=numeric,
                weight=weight,
                description=grade.title or grade.comment or "Grade",
                date=grade.date.date() if grade.date else None,
                max_points=grade.max_points,
            )
        )
    return grades


async def fetch_grades(edupage: Edupage) -> list[StudentGrade]:
    try:
        return await asyncio.to_thread(_grades_blocking, edupage)
    except Exception as exc:
        logger.warning("grades fetch failed: err=%s", type(exc).__name__)
        raise EduPageDataError("grades_failed", "Could not load grades from EduPage.")


@dataclass
class MealMenu:
    letter: str
    name: str | None
    allergens: str | None
    weight: str | None


@dataclass
class MealDay:
    date: date
    open: bool
    title: str | None
    options: list[MealMenu]
    ordered_meal: str | None
    can_be_changed_until: datetime | None


# Lunch is meal index "2" in EduPage's menu payload ("1" snack, "3" afternoon snack).
_LUNCH_INDEX = "2"
# Sentinel choice that tells EduPage to sign the student off the meal.
_SIGN_OFF = "AX"


def _listok_json_blocking(edupage: Edupage, day: date) -> tuple[dict, dict | None]:
    """Fetch and parse the raw canteen JSON for `day`.

    Returns ``(add_info, lunch_block)`` where ``add_info`` carries account-level
    fields (notably ``stravnikid``, needed to place orders) and ``lunch_block`` is
    the lunch ("2") meal dict, or None when the day has no menu.

    We deliberately bypass `edupage.get_meals()`: that helper raises
    `TypeError: cannot unpack non-iterable NoneType` when EduPage returns a menu
    with no per-option ratings (the case for some schools). We read the same
    `/menu/` endpoint and parse it ourselves, ignoring ratings entirely.
    """
    subdomain = edupage.subdomain
    url = f"https://{subdomain}.edupage.org/menu/?date={day.strftime('%Y%m%d')}"
    response = edupage.session.get(url).content.decode()

    # The page embeds the menu as `edupageData: {...},\r\n` — the same extraction
    # edupage-api uses internally.
    payload = json.loads(response.split("edupageData: ")[1].split(",\r\n")[0])
    school = payload.get(subdomain) or {}
    listok = school.get("novyListok") or {}
    add_info = listok.get("addInfo") or {}
    day_meals = listok.get(day.strftime("%Y-%m-%d")) or {}
    return add_info, day_meals.get(_LUNCH_INDEX)


def _lunch_json_blocking(edupage: Edupage, day: date) -> dict | None:
    """The lunch ("2") block for `day`, or None when the day has no menu."""
    _, lunch = _listok_json_blocking(edupage, day)
    return lunch


def _ordered_letter(lunch: dict | None) -> str | None:
    """The currently ordered option for a lunch block, or None if not ordered.

    `evidencia.stav` is the live order state: a menu letter ("A".."H") when that
    option is ordered, "X" when signed off, "V" when finalised (then `obj` holds
    the letter). `obj` alone is sticky history, not a reliable ordered signal.
    """
    record = (lunch or {}).get("evidencia") or {}
    stav = record.get("stav")
    if stav == "V":
        return record.get("obj")
    if stav and len(stav) == 1 and "A" <= stav <= "H":
        return stav
    return None


def _meal_day_blocking(edupage: Edupage, day: date) -> MealDay:
    lunch = _lunch_json_blocking(edupage, day)
    if not lunch or lunch.get("isCooking") is False:
        return MealDay(day, False, None, [], None, None)

    options: list[MealMenu] = []
    rows = [row for row in (lunch.get("rows") or []) if row]
    for i, food in enumerate(rows):
        # EduPage labels options "A", "B", ... in `menusStr`; fall back to a letter.
        letter = (food.get("menusStr") or "").replace(": ", "").strip() or chr(ord("A") + i)
        options.append(
            MealMenu(
                letter,
                food.get("nazov"),
                food.get("alergenyStr"),
                food.get("hmotnostiStr"),
            )
        )

    changed_until = lunch.get("zmen_do")
    if isinstance(changed_until, str):
        try:
            changed_until = datetime.strptime(changed_until, "%Y-%m-%d %H:%M")
        except ValueError:
            changed_until = None
    else:
        changed_until = None

    return MealDay(
        date=day,
        open=True,
        title=lunch.get("nazov"),
        options=options,
        ordered_meal=_ordered_letter(lunch),
        can_be_changed_until=changed_until,
    )


def _meals_blocking(edupage: Edupage, days: list[date]) -> list[MealDay]:
    # One EduPage round trip per day; kept sequential because the underlying
    # requests.Session is not thread-safe.
    result: list[MealDay] = []
    for day in days:
        try:
            result.append(_meal_day_blocking(edupage, day))
        except Exception as exc:
            logger.info("meals fetch failed for %s: err=%s", day, type(exc).__name__)
            result.append(MealDay(day, False, None, [], None, None))
    return result


async def fetch_meals(edupage: Edupage, days: list[date]) -> list[MealDay]:
    try:
        return await asyncio.to_thread(_meals_blocking, edupage, days)
    except Exception as exc:
        logger.warning("meals fetch failed: err=%s", type(exc).__name__)
        raise EduPageDataError("meals_failed", "Could not load canteen menus from EduPage.")


def _post_order_blocking(edupage: Edupage, day: date, boarder_id: str, choice_code: str) -> None:
    """POST the EduPage `ulozJedlaStravnika` action — the same call the library makes.

    `choice_code` is a menu letter ("A".."H") to order or the sign-off sentinel.
    Bypasses `Meal.choose()`/`Meal.sign_off()`, which require the crash-prone
    `get_meals()` to build the Meal object first.
    """
    boarder_menu = {
        "stravnikid": boarder_id,
        "mysqlDate": day.strftime("%Y-%m-%d"),
        "jids": {_LUNCH_INDEX: choice_code},
        "view": "pc_listok",
        "pravo": "Student",
    }
    data = {
        "akcia": "ulozJedlaStravnika",
        "jedlaStravnika": json.dumps(boarder_menu),
    }
    url = f"https://{edupage.subdomain}.edupage.org/menu/"
    response = edupage.session.post(url, data=data).content.decode()
    if json.loads(response).get("error"):
        raise EduPageDataError(
            "order_failed", "EduPage rejected the meal change. It may be past the deadline."
        )


def _order_blocking(
    edupage: Edupage, day: date, choice: str | None, verify: bool = True
) -> str | None:
    add_info, lunch = _listok_json_blocking(edupage, day)
    if not lunch or lunch.get("isCooking") is False:
        raise EduPageDataError("no_meal", "There is no orderable meal on that day.")

    boarder_id = add_info.get("stravnikid")
    if not boarder_id:
        raise EduPageDataError(
            "no_boarder", "Could not determine the canteen account for ordering."
        )

    if choice is None:
        choice_code = _SIGN_OFF
    else:
        number = ord(choice) - ord("A") + 1
        if number < 1 or number > (lunch.get("druhov_jedal") or 0):
            raise EduPageDataError(
                "bad_choice", f"Menu option {choice} does not exist on that day."
            )
        choice_code = choice

    _post_order_blocking(edupage, day, str(boarder_id), choice_code)

    # EduPage records orders silently — a `ulozJedlaStravnika` it ignores still
    # returns no error — so a successful POST is not proof the change landed. For a
    # single order we re-read the day and confirm. Bulk passes verify=False and
    # confirms once at the end instead: an immediate re-read inside a tight loop is
    # flaky (EduPage lags reflecting the change).
    if not verify:
        return choice
    _, confirmed = _listok_json_blocking(edupage, day)
    persisted = _ordered_letter(confirmed)
    if persisted != choice:
        raise EduPageDataError(
            "order_not_persisted",
            "EduPage did not record the meal change — the ordering window for that day may be closed.",
        )
    return persisted


async def order_meal(
    edupage: Edupage, day: date, choice: str | None, verify: bool = True
) -> str | None:
    """Order menu `choice` ("A", "B", …) for `day`, or sign off when None.

    Returns the resulting ordered meal letter (None after sign-off). With
    `verify=False` the post-write confirmation is skipped (the caller verifies).
    """
    try:
        return await asyncio.to_thread(_order_blocking, edupage, day, choice, verify)
    except EduPageDataError:
        raise
    except Exception as exc:
        logger.warning("meal order failed: day=%s err=%s", day, type(exc).__name__)
        raise EduPageDataError(
            "order_failed", "EduPage rejected the meal change. It may be past the deadline."
        )
