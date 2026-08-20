from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from middleware.auth import get_current_user
from services.revenue_service import (
    get_revenue_summary,
    extract_revenue_signals_from_email,
    scan_recent_emails_for_revenue,
    get_revenue_at_risk,
)
from database import get_supabase

router = APIRouter(prefix="/revenue", tags=["revenue"])


@router.get("/summary")
async def revenue_summary(current_user: dict = Depends(get_current_user)):
    return get_revenue_summary(current_user["id"])


@router.get("/at-risk")
async def revenue_at_risk(current_user: dict = Depends(get_current_user)):
    """Open deals/invoices tied to contacts whose relationship is declining or at risk."""
    at_risk = await get_revenue_at_risk(current_user["id"])
    return {"at_risk": at_risk, "total": len(at_risk)}


@router.post("/scan")
async def scan_emails(current_user: dict = Depends(get_current_user)):
    count = await scan_recent_emails_for_revenue(current_user["id"])
    return {"signals_found": count}


@router.post("/signals/{email_id}")
async def extract_from_email(email_id: str, current_user: dict = Depends(get_current_user)):
    signals = await extract_revenue_signals_from_email(email_id, current_user["id"])
    return {"signals": signals}


class SignalUpdate(BaseModel):
    status: str  # open|won|lost|dismissed


@router.patch("/signals/{signal_id}")
async def update_signal(signal_id: str, body: SignalUpdate, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    supabase.table("revenue_signals").update({"status": body.status}).eq("id", signal_id).eq("user_id", current_user["id"]).execute()
    return {"status": body.status}
