from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from middleware.auth import get_current_user
from services.touchpoint_service import log_touchpoint, get_touchpoints, delete_touchpoint

router = APIRouter(prefix="/touchpoints", tags=["touchpoints"])


def _user_id(current_user: dict) -> str:
    return current_user["id"]


class TouchpointCreate(BaseModel):
    contact_email: str
    contact_name: str | None = None
    channel: str = "call"  # call | sms | whatsapp | meeting | other
    direction: str = "outbound"  # inbound | outbound
    summary: str | None = None
    duration_minutes: int | None = None
    occurred_at: str | None = None


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_touchpoint(body: TouchpointCreate, current_user: Annotated[dict, Depends(get_current_user)]):
    """Manually log a call / SMS / WhatsApp message / meeting with a contact."""
    touchpoint = log_touchpoint(
        user_id=_user_id(current_user),
        contact_email=body.contact_email,
        contact_name=body.contact_name,
        channel=body.channel,
        direction=body.direction,
        summary=body.summary,
        duration_minutes=body.duration_minutes,
        occurred_at=body.occurred_at,
    )
    if not touchpoint:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to log touchpoint.")
    return touchpoint


@router.get("")
async def list_touchpoints(contact_email: str, current_user: Annotated[dict, Depends(get_current_user)]):
    touchpoints = get_touchpoints(_user_id(current_user), contact_email)
    return {"touchpoints": touchpoints, "total": len(touchpoints)}


@router.delete("/{touchpoint_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_touchpoint(touchpoint_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    ok = delete_touchpoint(touchpoint_id, _user_id(current_user))
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Touchpoint not found.")
