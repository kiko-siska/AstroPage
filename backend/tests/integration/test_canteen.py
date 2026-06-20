"""Canteen meals + order endpoints — hermetic."""

from datetime import date, timedelta

from app.services import edupage_service
from app.services.canteen_service import next_school_days
from app.services.edupage_service import EduPageDataError, MealDay, MealMenu


def test_meals_requires_auth(client):
    assert client.get("/api/v1/canteen/meals").status_code == 401


def test_meals_returns_days(auth_client, monkeypatch):
    async def fake_meals(edupage, days):
        return [
            MealDay(
                date=days[0],
                open=True,
                title="Lunch",
                options=[MealMenu("A", "Schnitzel", "1,3", "120g")],
                ordered_meal="A",
                can_be_changed_until=None,
            ),
            MealDay(days[1], False, None, [], None, None),
        ]

    monkeypatch.setattr(edupage_service, "fetch_meals", fake_meals)

    res = auth_client.get("/api/v1/canteen/meals?weeks=1")
    assert res.status_code == 200
    body = res.json()
    assert body[0]["open"] is True
    assert body[0]["ordered_meal"] == "A"
    assert body[0]["options"][0]["letter"] == "A"
    assert body[1]["open"] is False


def test_order_chooses_menu(auth_client, monkeypatch):
    async def fake_order(edupage, day, choice):
        assert day == date(2026, 6, 15)
        assert choice == "B"
        return "B"

    monkeypatch.setattr(edupage_service, "order_meal", fake_order)

    res = auth_client.post("/api/v1/canteen/order", json={"date": "2026-06-15", "choice": "B"})
    assert res.status_code == 200
    assert res.json() == {"date": "2026-06-15", "ordered_meal": "B"}


def test_order_sign_off(auth_client, monkeypatch):
    async def fake_order(edupage, day, choice):
        assert choice is None
        return None

    monkeypatch.setattr(edupage_service, "order_meal", fake_order)

    res = auth_client.post("/api/v1/canteen/order", json={"date": "2026-06-15", "choice": None})
    assert res.status_code == 200
    assert res.json()["ordered_meal"] is None


def test_order_bad_choice_is_422(auth_client, monkeypatch):
    async def fake_order(edupage, day, choice):
        raise EduPageDataError("bad_choice", "Menu option Z does not exist on that day.")

    monkeypatch.setattr(edupage_service, "order_meal", fake_order)

    res = auth_client.post("/api/v1/canteen/order", json={"date": "2026-06-15", "choice": "C"})
    assert res.status_code == 422


def test_order_rejects_invalid_letter(auth_client):
    res = auth_client.post("/api/v1/canteen/order", json={"date": "2026-06-15", "choice": "Z"})
    assert res.status_code == 422


def test_bulk_signup_requires_auth(client):
    res = client.post(
        "/api/v1/canteen/bulk-signup", json={"days_count": 5, "preferred_choice": "A"}
    )
    assert res.status_code == 401


def test_bulk_signup_returns_summary(auth_client, monkeypatch):
    # bulk-signup walks school days (weekends skipped); close the second one.
    school_days = next_school_days(date.today() + timedelta(days=1), count=2)
    closed = {school_days[1]}  # second school day is closed
    persisted: dict = {}
    ordered: list = []

    async def fake_meals(edupage, days):
        out = []
        for d in days:
            if d in closed:
                out.append(MealDay(d, False, None, [], None, None))
            else:
                out.append(
                    MealDay(
                        d,
                        True,
                        "Lunch",
                        [MealMenu("A", "Schnitzel", None, None)],
                        persisted.get(d),
                        None,
                    )
                )
        return out

    async def fake_order(edupage, day, choice, verify=True):
        ordered.append((day, choice))
        persisted[day] = choice  # the order lands
        return choice

    monkeypatch.setattr(edupage_service, "fetch_meals", fake_meals)
    monkeypatch.setattr(edupage_service, "order_meal", fake_order)

    res = auth_client.post(
        "/api/v1/canteen/bulk-signup", json={"days_count": 2, "preferred_choice": "A"}
    )
    assert res.status_code == 200
    assert res.json() == {"updated_days": 1, "skipped_days": 1}
    assert len(ordered) == 1


def test_bulk_signup_rejects_invalid_days(auth_client):
    res = auth_client.post(
        "/api/v1/canteen/bulk-signup", json={"days_count": 0, "preferred_choice": "A"}
    )
    assert res.status_code == 422
