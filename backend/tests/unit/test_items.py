def test_create_item(client):
    r = client.post("/api/v1/items", json={"name": "Sword", "description": "Sharp"})
    assert r.status_code == 201
    data = r.json()
    assert data["id"] == 1
    assert data["name"] == "Sword"


def test_list_items_empty(client):
    r = client.get("/api/v1/items")
    assert r.status_code == 200
    assert r.json() == []


def test_list_items_after_create(client):
    client.post("/api/v1/items", json={"name": "Shield"})
    client.post("/api/v1/items", json={"name": "Bow"})
    r = client.get("/api/v1/items")
    assert len(r.json()) == 2


def test_get_item(client):
    client.post("/api/v1/items", json={"name": "Staff"})
    r = client.get("/api/v1/items/1")
    assert r.status_code == 200
    assert r.json()["name"] == "Staff"


def test_get_item_not_found(client):
    r = client.get("/api/v1/items/999")
    assert r.status_code == 404


def test_update_item(client):
    client.post("/api/v1/items", json={"name": "Dagger"})
    r = client.patch("/api/v1/items/1", json={"name": "Golden Dagger"})
    assert r.status_code == 200
    assert r.json()["name"] == "Golden Dagger"


def test_delete_item(client):
    client.post("/api/v1/items", json={"name": "Axe"})
    r = client.delete("/api/v1/items/1")
    assert r.status_code == 204
    r2 = client.get("/api/v1/items/1")
    assert r2.status_code == 404


def test_create_item_name_too_short(client):
    r = client.post("/api/v1/items", json={"name": ""})
    assert r.status_code == 422
