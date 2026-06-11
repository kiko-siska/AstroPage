from app.models.item import Item
from app.schemas.item import ItemCreate, ItemUpdate

# In-memory store — swap for a DB session in production
_store: dict[int, Item] = {}
_counter: int = 0


def list_items() -> list[Item]:
    return list(_store.values())


def get_item(item_id: int) -> Item | None:
    return _store.get(item_id)


def create_item(data: ItemCreate) -> Item:
    global _counter
    _counter += 1
    item = Item(id=_counter, name=data.name, description=data.description)
    _store[_counter] = item
    return item


def update_item(item_id: int, data: ItemUpdate) -> Item | None:
    item = _store.get(item_id)
    if not item:
        return None
    if data.name is not None:
        item.name = data.name
    if data.description is not None:
        item.description = data.description
    return item


def delete_item(item_id: int) -> bool:
    if item_id not in _store:
        return False
    del _store[item_id]
    return True
