"""Homework list + AI draft endpoints — hermetic."""

from datetime import UTC, datetime
from types import SimpleNamespace

from app.api.v1.endpoints import homework as homework_endpoint
from app.services import edupage_service
from app.services.edupage_service import (
    EduPageDataError,
    HomeworkAssignment,
    HomeworkAttachment,
)


def test_list_requires_auth(client):
    assert client.get("/api/v1/homework/list").status_code == 401


def test_list_returns_assignments(auth_client, monkeypatch):
    async def fake_homework(edupage):
        return [
            HomeworkAssignment(
                id="123",
                subject="Physics",
                title="Lab report",
                description="Write up the pendulum lab.",
                teacher="RNDr. K",
                assigned_at=datetime(2026, 6, 10, 8, 0),
                due_date=datetime(2026, 6, 15, 23, 59),
                is_done=False,
            )
        ]

    monkeypatch.setattr(edupage_service, "fetch_homework", fake_homework)

    res = auth_client.get("/api/v1/homework/list")
    assert res.status_code == 200
    [item] = res.json()
    assert item["id"] == "123"
    assert item["subject"] == "Physics"
    assert item["is_done"] is False
    assert item["due_date"].startswith("2026-06-15")


def test_generate_ai_returns_draft(auth_client, monkeypatch):
    fake_draft = SimpleNamespace(
        assignment_id="123",
        ai_response="# Draft\n\nstep by step…",
        created_at=datetime.now(UTC),
    )

    async def fake_generate(db, user, edupage, assignment_id, force=False):
        assert assignment_id == "123"
        return fake_draft, False

    monkeypatch.setattr(homework_endpoint.homework_service, "generate_draft", fake_generate)

    res = auth_client.post("/api/v1/homework/generate-ai", json={"assignment_id": "123"})
    assert res.status_code == 200
    body = res.json()
    assert body["draft"].startswith("# Draft")
    assert body["cached"] is False


def test_generate_ai_unknown_assignment_is_404(auth_client, monkeypatch):
    async def fake_generate(db, user, edupage, assignment_id, force=False):
        raise EduPageDataError("not_found", "That assignment was not found on EduPage.")

    monkeypatch.setattr(homework_endpoint.homework_service, "generate_draft", fake_generate)

    res = auth_client.post("/api/v1/homework/generate-ai", json={"assignment_id": "nope"})
    assert res.status_code == 404


def _hw(**kwargs) -> HomeworkAssignment:
    base = dict(
        id="123",
        subject="Physics",
        title="Lab report",
        description="Write up the pendulum lab.",
        teacher="RNDr. K",
        assigned_at=datetime(2026, 6, 10, 8, 0),
        due_date=datetime(2026, 6, 15, 23, 59),
        is_done=False,
    )
    base.update(kwargs)
    return HomeworkAssignment(**base)


def test_list_exposes_has_attachments(auth_client, monkeypatch):
    async def fake_homework(edupage):
        return [_hw(has_attachments=True, superid="36216")]

    monkeypatch.setattr(edupage_service, "fetch_homework", fake_homework)

    res = auth_client.get("/api/v1/homework/list")
    assert res.status_code == 200
    [item] = res.json()
    assert item["has_attachments"] is True
    # superid is server-side only and must not leak to the client.
    assert "superid" not in item


def test_attachments_requires_auth(client):
    assert client.get("/api/v1/homework/123/attachments").status_code == 401


def test_attachments_returns_files(auth_client, monkeypatch):
    async def fake_homework(edupage):
        return [_hw(has_attachments=True, superid="36216")]

    async def fake_attachments(edupage, superid):
        assert superid == "36216"
        return [
            HomeworkAttachment(
                name="task.pdf", url="https://x/task.pdf", type="pdf", extension="pdf"
            )
        ]

    monkeypatch.setattr(edupage_service, "fetch_homework", fake_homework)
    monkeypatch.setattr(edupage_service, "fetch_homework_attachments", fake_attachments)

    res = auth_client.get("/api/v1/homework/123/attachments")
    assert res.status_code == 200
    [att] = res.json()
    assert att["name"] == "task.pdf"
    assert att["url"] == "https://x/task.pdf"


def test_attachments_empty_when_no_etest(auth_client, monkeypatch):
    async def fake_homework(edupage):
        return [_hw(has_attachments=False, superid=None)]

    monkeypatch.setattr(edupage_service, "fetch_homework", fake_homework)

    res = auth_client.get("/api/v1/homework/123/attachments")
    assert res.status_code == 200
    assert res.json() == []


def test_attachments_unknown_assignment_is_404(auth_client, monkeypatch):
    async def fake_homework(edupage):
        return []

    monkeypatch.setattr(edupage_service, "fetch_homework", fake_homework)

    res = auth_client.get("/api/v1/homework/nope/attachments")
    assert res.status_code == 404


def test_mark_done_requires_auth(client):
    assert client.post("/api/v1/homework/123/done", json={"done": True}).status_code == 401


def test_mark_done_toggles_state(auth_client, monkeypatch):
    async def fake_homework(edupage):
        return [_hw(id="123", is_done=False)]

    calls: list = []

    async def fake_set_done(edupage, assignment_id, done):
        calls.append((assignment_id, done))

    monkeypatch.setattr(edupage_service, "fetch_homework", fake_homework)
    monkeypatch.setattr(edupage_service, "set_homework_done", fake_set_done)

    res = auth_client.post("/api/v1/homework/123/done", json={"done": True})
    assert res.status_code == 200
    assert res.json() == {"assignment_id": "123", "is_done": True}
    assert calls == [("123", True)]


def test_mark_done_unknown_assignment_is_404(auth_client, monkeypatch):
    async def fake_homework(edupage):
        return []

    monkeypatch.setattr(edupage_service, "fetch_homework", fake_homework)

    res = auth_client.post("/api/v1/homework/nope/done", json={"done": True})
    assert res.status_code == 404


def test_mark_done_edupage_refusal_is_502(auth_client, monkeypatch):
    async def fake_homework(edupage):
        return [_hw(id="123")]

    async def fake_set_done(edupage, assignment_id, done):
        raise EduPageDataError("done_failed", "EduPage refused to update the homework state.")

    monkeypatch.setattr(edupage_service, "fetch_homework", fake_homework)
    monkeypatch.setattr(edupage_service, "set_homework_done", fake_set_done)

    res = auth_client.post("/api/v1/homework/123/done", json={"done": True})
    assert res.status_code == 502
