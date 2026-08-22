from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from middleware.auth import get_current_user
from services.notification_service import list_notifications, unread_count, mark_read, mark_all_read

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _uid(u: dict) -> str:
    return u["id"]


@router.get("")
async def get_notifications(current_user: Annotated[dict, Depends(get_current_user)]):
    user_id = _uid(current_user)
    return {"notifications": list_notifications(user_id), "unread_count": unread_count(user_id)}


@router.post("/{notification_id}/read")
async def read_notification(notification_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    ok = mark_read(notification_id, _uid(current_user))
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    return {"status": "read"}


@router.post("/read-all")
async def read_all_notifications(current_user: Annotated[dict, Depends(get_current_user)]):
    mark_all_read(_uid(current_user))
    return {"status": "ok"}
