import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import item_service


@pytest.fixture(autouse=True)
def reset_item_store():
    """Reset in-memory store and counter between tests."""
    item_service._store.clear()
    item_service._counter = 0
    yield
    item_service._store.clear()
    item_service._counter = 0


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
