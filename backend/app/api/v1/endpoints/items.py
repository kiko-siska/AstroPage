from fastapi import APIRouter, HTTPException, status

from app.schemas.item import ItemCreate, ItemResponse, ItemUpdate
from app.services import item_service

router = APIRouter(prefix="/items", tags=["items"])


@router.get("", response_model=list[ItemResponse])
async def list_items():
    return item_service.list_items()


@router.post("", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(data: ItemCreate):
    return item_service.create_item(data)


@router.get("/{item_id}", response_model=ItemResponse)
async def get_item(item_id: int):
    item = item_service.get_item(item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return item


@router.patch("/{item_id}", response_model=ItemResponse)
async def update_item(item_id: int, data: ItemUpdate):
    item = item_service.update_item(item_id, data)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(item_id: int):
    if not item_service.delete_item(item_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
