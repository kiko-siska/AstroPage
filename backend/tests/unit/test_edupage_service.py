"""edupage_service: e-test attachment parsing (no network)."""

import base64
import json
import urllib.parse
from types import SimpleNamespace

import pytest

from app.services.edupage_service import (
    EduPageDataError,
    _collect_files,
    _edu_encode_body,
    _etest_files_blocking,
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


def test_set_homework_done_posts_homework_flag(monkeypatch):
    sent = {}

    class FakeResp:
        def raise_for_status(self):
            pass

        def json(self):
            return {"timelineUserProps": {}}

    def fake_post(url, data, headers):
        sent["url"] = url
        sent["data"] = data
        return FakeResp()

    edupage = SimpleNamespace(subdomain="myschool", session=SimpleNamespace(post=fake_post))

    _set_homework_done_blocking(edupage, "98765", True)

    assert sent["url"] == "https://myschool.edupage.org/timeline/?akcia=homeworkFlag"
    fields = _decode_eqap(sent["data"])
    assert fields["homeworkid"] == ["timeline:98765"]
    assert fields["flag"] == ["done"]
    assert fields["value"] == ["1"]


def test_set_homework_done_clear_sends_zero():
    captured = {}

    class FakeResp:
        def raise_for_status(self):
            pass

        def json(self):
            return {"timelineUserProps": {}}

    def fake_post(url, data, headers):
        captured["data"] = data
        return FakeResp()

    edupage = SimpleNamespace(subdomain="s", session=SimpleNamespace(post=fake_post))
    _set_homework_done_blocking(edupage, "1", False)
    assert _decode_eqap(captured["data"])["value"] == ["0"]


def test_set_homework_done_without_userprops_raises():
    class FakeResp:
        def raise_for_status(self):
            pass

        def json(self):
            return {"status": "fail"}  # no timelineUserProps → refusal

    edupage = SimpleNamespace(
        subdomain="s", session=SimpleNamespace(post=lambda url, data, headers: FakeResp())
    )
    with pytest.raises(EduPageDataError):
        _set_homework_done_blocking(edupage, "1", True)
