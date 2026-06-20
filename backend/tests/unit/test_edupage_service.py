"""edupage_service: e-test attachment parsing (no network)."""

import base64
import json
import urllib.parse
from datetime import date
from types import SimpleNamespace

import pytest

from app.services import edupage_service
from app.services.edupage_service import (
    EduPageDataError,
    _collect_files,
    _edu_encode_body,
    _etest_files_blocking,
    _grades_blocking,
    _order_blocking,
    _set_homework_done_blocking,
)


def test_edu_encode_body_roundtrips_to_base64_querystring():
    body = _edu_encode_body({"superid": "36216"})
    assert body.endswith("&eqaz=0")
    eqap = body.removeprefix("eqap=").removesuffix("&eqaz=0")
    decoded = base64.b64decode(urllib.parse.unquote(eqap)).decode()
    assert decoded == "superid=36216"


def test_collect_files_recurses_and_builds_urls():
    node = {
        "rows": [
            {
                "props": {
                    "files": [
                        {
                            "src": "/a/task.pdf",
                            "name": "task.pdf",
                            "type": "pdf",
                            "extension": "pdf",
                        }
                    ]
                }
            },
            {"nested": {"props": {"files": [{"src": "/b/diagram.png", "extension": "png"}]}}},
            {"props": {"files": "not-a-list"}},  # ignored
        ]
    }
    out = []
    _collect_files(node, "myschool", out)

    assert [a.url for a in out] == [
        "https://myschool.edupage.org/a/task.pdf",
        "https://myschool.edupage.org/b/diagram.png",
    ]
    # name falls back to the basename of src when absent.
    assert out[1].name == "diagram.png"


def test_etest_files_blocking_parses_cards_and_dedupes(monkeypatch):
    duplicate = {"src": "/x/shared.pdf", "name": "shared.pdf"}
    payload = {
        "materialData": {
            "cardsData": {
                # content as a JSON string (the common case) and as a dict.
                "c1": {"content": json.dumps({"props": {"files": [duplicate]}})},
                "c2": {
                    "content": {
                        "props": {
                            "files": [duplicate, {"src": "/x/extra.docx", "name": "extra.docx"}]
                        }
                    }
                },
                "c3": {"content": "not json"},  # skipped
            }
        }
    }

    class FakeResp:
        def raise_for_status(self):
            pass

        def json(self):
            return payload

    posted = {}

    def fake_post(url, data, headers):
        posted["url"] = url
        return FakeResp()

    edupage = SimpleNamespace(subdomain="myschool", session=SimpleNamespace(post=fake_post))

    files = _etest_files_blocking(edupage, "36216")

    assert "EtestCreator" in posted["url"]
    # shared.pdf appears twice across cards but is de-duplicated by url.
    assert [f.name for f in files] == ["shared.pdf", "extra.docx"]


def _decode_eqap(body: str) -> dict[str, list[str]]:
    eqap = body.removeprefix("eqap=").removesuffix("&eqaz=0")
    return urllib.parse.parse_qs(base64.b64decode(urllib.parse.unquote(eqap)).decode())


def _fake_edupage(resp_json, subdomain="myschool"):
    sent = {}

    class FakeResp:
        def raise_for_status(self):
            pass

        def json(self):
            return resp_json

    def fake_post(url, data, headers):
        sent["url"] = url
        sent["data"] = data
        return FakeResp()

    return SimpleNamespace(subdomain=subdomain, session=SimpleNamespace(post=fake_post)), sent


def test_set_homework_done_posts_superid_homework_flag():
    # EduPage confirms by echoing doneMaxCas for the timeline id.
    edupage, sent = _fake_edupage(
        {"timelineUserProps": {"98765": {"doneMaxCas": "2026-01-01 10:00:00"}}}
    )

    _set_homework_done_blocking(edupage, "36627", "98765", True)

    assert sent["url"] == "https://myschool.edupage.org/timeline/?akcia=homeworkFlag"
    fields = _decode_eqap(sent["data"])
    assert fields["homeworkid"] == ["superid:36627"]  # not "timeline:<id>"
    assert fields["flag"] == ["done"]
    assert fields["value"] == ["1"]


def test_set_homework_done_clear_sends_zero():
    # Clearing: no doneMaxCas for the item confirms not-done.
    edupage, sent = _fake_edupage({"timelineUserProps": {"1": {}}})
    _set_homework_done_blocking(edupage, "36627", "1", False)
    assert _decode_eqap(sent["data"])["value"] == ["0"]


def test_set_homework_done_without_userprops_raises():
    edupage, _ = _fake_edupage({"status": "fail"})  # no timelineUserProps → refusal
    with pytest.raises(EduPageDataError):
        _set_homework_done_blocking(edupage, "36627", "1", True)


def test_set_homework_done_not_applied_raises():
    # 200 with userProps but the item never got doneMaxCas → change didn't stick.
    edupage, _ = _fake_edupage({"timelineUserProps": {"1": {}}})
    with pytest.raises(EduPageDataError):
        _set_homework_done_blocking(edupage, "36627", "1", True)


# ── Meal ordering: verify-after-write ─────────────────────────────────────────
# A `ulozJedlaStravnika` POST EduPage silently ignores still returns no error, so
# the service re-reads the day (via the raw `/menu/` JSON) to confirm an order
# actually landed. These tests patch the GET/POST seams to model that.


def _patch_order_seams(monkeypatch, server: dict):
    """Wire `_listok_json_blocking`/`_post_order_blocking` to a shared `server`
    dict {"ordered": <letter|None>, "persist": bool}, mirroring EduPage's state."""

    def fake_listok(edupage, day):
        ordered = server["ordered"]
        # evidencia.stav is a letter when ordered, "X" when signed off.
        lunch = {
            "isCooking": True,
            "druhov_jedal": 2,
            "evidencia": {"stav": ordered or "X", "obj": ordered or "X"},
        }
        return {"stravnikid": "1707"}, lunch

    def fake_post(edupage, day, boarder_id, code):
        if server["persist"]:
            server["ordered"] = None if code == edupage_service._SIGN_OFF else code

    monkeypatch.setattr(edupage_service, "_listok_json_blocking", fake_listok)
    monkeypatch.setattr(edupage_service, "_post_order_blocking", fake_post)


def test_order_blocking_returns_choice_when_it_persists(monkeypatch):
    server = {"ordered": None, "persist": True}
    _patch_order_seams(monkeypatch, server)
    result = _order_blocking(object(), date(2026, 6, 15), "A")
    assert result == "A"
    assert server["ordered"] == "A"


def test_order_blocking_raises_when_order_silently_ignored(monkeypatch):
    # The far-future-day case: the POST doesn't error, but the re-read shows the
    # order never landed → must surface as an error, not a false success.
    server = {"ordered": None, "persist": False}
    _patch_order_seams(monkeypatch, server)
    with pytest.raises(EduPageDataError) as exc:
        _order_blocking(object(), date(2026, 6, 15), "A")
    assert exc.value.reason == "order_not_persisted"


def test_order_blocking_sign_off_confirmed(monkeypatch):
    server = {"ordered": "A", "persist": True}
    _patch_order_seams(monkeypatch, server)
    assert _order_blocking(object(), date(2026, 6, 15), None) is None
    assert server["ordered"] is None


# ── Grades: the "A" (absent) mark counts as a 5 ───────────────────────────────


def _fake_edu_grade(grade_n, *, verbal=False, importance=1.0, max_points=None):
    return SimpleNamespace(
        event_id=1,
        subject_name="Mathematics",
        grade_n=grade_n,
        verbal=verbal,
        importance=importance,
        max_points=max_points,
        title="Test",
        comment=None,
        date=None,
    )


def test_absent_mark_counts_as_five():
    edupage = SimpleNamespace(get_grades=lambda: [_fake_edu_grade("A", verbal=True)])
    [grade] = _grades_blocking(edupage)
    assert grade.value == "A"
    assert grade.numeric_value == 5.0  # drags the average down, not dropped as verbal


def test_absent_mark_in_points_subject_counts_as_zero():
    # "A/20": absent in a points subject → 0 earned (not 5, which would corrupt
    # the percentage). Keeps the simulated average in step with the official one.
    edupage = SimpleNamespace(
        get_grades=lambda: [_fake_edu_grade("A", verbal=True, max_points=20.0)]
    )
    [grade] = _grades_blocking(edupage)
    assert grade.value == "A"
    assert grade.max_points == 20.0
    assert grade.numeric_value == 0.0


def test_partial_decimal_points_grade_is_parsed():
    # EduPage keeps "14.75" as a string (str.isdigit() rejects the dot); it must
    # still be counted, not dropped.
    edupage = SimpleNamespace(get_grades=lambda: [_fake_edu_grade("14.75", max_points=15.0)])
    [grade] = _grades_blocking(edupage)
    assert grade.value == "14.75"
    assert grade.numeric_value == 14.75
    assert grade.max_points == 15.0


def test_other_verbal_marks_stay_non_numeric():
    edupage = SimpleNamespace(get_grades=lambda: [_fake_edu_grade("Absent", verbal=True)])
    [grade] = _grades_blocking(edupage)
    assert grade.numeric_value is None


def test_normal_numeric_grade_unchanged():
    edupage = SimpleNamespace(get_grades=lambda: [_fake_edu_grade(2.0)])
    [grade] = _grades_blocking(edupage)
    assert grade.value == "2"
    assert grade.numeric_value == 2.0
