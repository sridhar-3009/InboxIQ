"""
Email marketing — audiences, campaigns, sending, and usage.
"""
import logging
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from database import get_supabase
from middleware.auth import get_current_user
from services import campaign_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["campaigns"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _get_user_org(user_id: str) -> dict:
    supabase = get_supabase()
    row = supabase.table("user_profiles").select("org_id, name, email").eq("id", user_id).single().execute()
    return row.data or {}


def _require_org(user_data: dict) -> str:
    org_id = user_data.get("org_id")
    if not org_id:
        raise HTTPException(status_code=404, detail="You are not part of any organization yet.")
    return org_id


# ─── Audiences ──────────────────────────────────────────────────────────────

class AudienceCreate(BaseModel):
    name: str


class ContactsAdd(BaseModel):
    emails_raw: str  # newline or comma separated "email" or "Name <email>"


@router.get("/marketing/audiences")
async def list_audiences(current_user: Annotated[dict, Depends(get_current_user)]):
    org_id = _require_org(_get_user_org(current_user["id"]))
    supabase = get_supabase()
    audiences = (
        supabase.table("marketing_audiences").select("id, name, created_at").eq("org_id", org_id)
        .order("created_at", desc=True).execute()
    ).data or []
    for a in audiences:
        count = (
            supabase.table("marketing_audience_contacts").select("id", count="exact")
            .eq("audience_id", a["id"]).eq("subscribed", True).execute()
        )
        a["contact_count"] = count.count or 0
    return {"audiences": audiences}


@router.post("/marketing/audiences")
async def create_audience(body: AudienceCreate, current_user: Annotated[dict, Depends(get_current_user)]):
    org_id = _require_org(_get_user_org(current_user["id"]))
    supabase = get_supabase()
    result = supabase.table("marketing_audiences").insert(
        {"org_id": org_id, "name": body.name.strip(), "created_by": current_user["id"]}
    ).execute()
    return result.data[0]


@router.delete("/marketing/audiences/{audience_id}")
async def delete_audience(audience_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    org_id = _require_org(_get_user_org(current_user["id"]))
    supabase = get_supabase()
    supabase.table("marketing_audiences").delete().eq("id", audience_id).eq("org_id", org_id).execute()
    return {"status": "deleted"}


def _parse_emails(raw: str) -> list[tuple[str, str | None]]:
    parsed = []
    for line in re.split(r"[\n,]+", raw):
        line = line.strip()
        if not line:
            continue
        m = re.match(r"^(.*?)<([^>]+)>$", line)
        if m:
            name, email = m.group(1).strip() or None, m.group(2).strip().lower()
        else:
            name, email = None, line.lower()
        if EMAIL_RE.match(email):
            parsed.append((email, name))
    return parsed


@router.post("/marketing/audiences/{audience_id}/contacts")
async def add_contacts(audience_id: str, body: ContactsAdd, current_user: Annotated[dict, Depends(get_current_user)]):
    org_id = _require_org(_get_user_org(current_user["id"]))
    supabase = get_supabase()

    audience = supabase.table("marketing_audiences").select("id").eq("id", audience_id).eq("org_id", org_id).maybe_single().execute()
    if not audience or not audience.data:
        raise HTTPException(status_code=404, detail="Audience not found.")

    parsed = _parse_emails(body.emails_raw)
    if not parsed:
        raise HTTPException(status_code=400, detail="No valid email addresses found.")

    rows = [{"audience_id": audience_id, "email": email, "name": name} for email, name in parsed]
    supabase.table("marketing_audience_contacts").upsert(rows, on_conflict="audience_id,email").execute()
    return {"added": len(rows)}


@router.get("/marketing/audiences/{audience_id}/contacts")
async def list_contacts(audience_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    org_id = _require_org(_get_user_org(current_user["id"]))
    supabase = get_supabase()
    audience = supabase.table("marketing_audiences").select("id").eq("id", audience_id).eq("org_id", org_id).maybe_single().execute()
    if not audience or not audience.data:
        raise HTTPException(status_code=404, detail="Audience not found.")
    contacts = (
        supabase.table("marketing_audience_contacts")
        .select("id, email, name, subscribed, created_at")
        .eq("audience_id", audience_id).order("created_at", desc=True).execute()
    ).data or []
    return {"contacts": contacts}


@router.delete("/marketing/audiences/{audience_id}/contacts/{contact_id}")
async def remove_contact(audience_id: str, contact_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    org_id = _require_org(_get_user_org(current_user["id"]))
    supabase = get_supabase()
    audience = supabase.table("marketing_audiences").select("id").eq("id", audience_id).eq("org_id", org_id).maybe_single().execute()
    if not audience or not audience.data:
        raise HTTPException(status_code=404, detail="Audience not found.")
    supabase.table("marketing_audience_contacts").delete().eq("id", contact_id).eq("audience_id", audience_id).execute()
    return {"status": "deleted"}


# ─── Campaigns ──────────────────────────────────────────────────────────────

class CampaignCreate(BaseModel):
    name: str
    audience_id: str
    subject: str
    body_html: str
    from_name: str | None = None


class CampaignUpdate(BaseModel):
    name: str | None = None
    subject: str | None = None
    body_html: str | None = None
    from_name: str | None = None
    audience_id: str | None = None


@router.get("/marketing/campaigns")
async def list_campaigns(current_user: Annotated[dict, Depends(get_current_user)]):
    org_id = _require_org(_get_user_org(current_user["id"]))
    supabase = get_supabase()
    campaigns = (
        supabase.table("marketing_campaigns")
        .select("id, name, subject, status, audience_id, created_at, sent_at")
        .eq("org_id", org_id).order("created_at", desc=True).execute()
    ).data or []
    return {"campaigns": campaigns}


@router.post("/marketing/campaigns")
async def create_campaign(body: CampaignCreate, current_user: Annotated[dict, Depends(get_current_user)]):
    org_id = _require_org(_get_user_org(current_user["id"]))
    supabase = get_supabase()

    audience = supabase.table("marketing_audiences").select("id").eq("id", body.audience_id).eq("org_id", org_id).maybe_single().execute()
    if not audience or not audience.data:
        raise HTTPException(status_code=404, detail="Audience not found.")

    result = supabase.table("marketing_campaigns").insert(
        {
            "org_id": org_id,
            "audience_id": body.audience_id,
            "name": body.name.strip(),
            "subject": body.subject,
            "body_html": body.body_html,
            "from_name": body.from_name,
            "created_by": current_user["id"],
        }
    ).execute()
    return result.data[0]


@router.get("/marketing/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    org_id = _require_org(_get_user_org(current_user["id"]))
    supabase = get_supabase()
    campaign = supabase.table("marketing_campaigns").select("*").eq("id", campaign_id).eq("org_id", org_id).maybe_single().execute()
    if not campaign or not campaign.data:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    recipients = (
        supabase.table("marketing_campaign_recipients").select("status", count="exact")
        .eq("campaign_id", campaign_id).execute()
    )
    stats: dict[str, int] = {}
    for r in recipients.data or []:
        stats[r["status"]] = stats.get(r["status"], 0) + 1
    return {**campaign.data, "stats": stats}


@router.put("/marketing/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, body: CampaignUpdate, current_user: Annotated[dict, Depends(get_current_user)]):
    org_id = _require_org(_get_user_org(current_user["id"]))
    supabase = get_supabase()
    campaign = supabase.table("marketing_campaigns").select("status").eq("id", campaign_id).eq("org_id", org_id).maybe_single().execute()
    if not campaign or not campaign.data:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    if campaign.data["status"] != "draft":
        raise HTTPException(status_code=400, detail="Only draft campaigns can be edited.")

    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if updates:
        supabase.table("marketing_campaigns").update(updates).eq("id", campaign_id).execute()
    result = supabase.table("marketing_campaigns").select("*").eq("id", campaign_id).single().execute()
    return result.data


@router.delete("/marketing/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    org_id = _require_org(_get_user_org(current_user["id"]))
    supabase = get_supabase()
    supabase.table("marketing_campaigns").delete().eq("id", campaign_id).eq("org_id", org_id).execute()
    return {"status": "deleted"}


@router.post("/marketing/campaigns/{campaign_id}/send")
async def send_campaign(campaign_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    org_id = _require_org(_get_user_org(current_user["id"]))
    supabase = get_supabase()
    campaign = supabase.table("marketing_campaigns").select("org_id").eq("id", campaign_id).maybe_single().execute()
    if not campaign or not campaign.data or campaign.data["org_id"] != org_id:
        raise HTTPException(status_code=404, detail="Campaign not found.")

    usage = campaign_service.get_usage(org_id)
    if usage["remaining"] <= 0:
        raise HTTPException(
            status_code=402,
            detail=f"You've used all {usage['limit']} emails on your {usage['plan']} plan this month. Upgrade to send more.",
        )

    try:
        result = await campaign_service.send_campaign(campaign_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return result


@router.get("/marketing/usage")
async def usage(current_user: Annotated[dict, Depends(get_current_user)]):
    org_id = _require_org(_get_user_org(current_user["id"]))
    return campaign_service.get_usage(org_id)


# ─── Public: unsubscribe + Resend webhook ──────────────────────────────────

@router.get("/marketing/unsubscribe", response_class=HTMLResponse, include_in_schema=False)
async def unsubscribe(token: str):
    ok = campaign_service.unsubscribe_by_token(token)
    message = "You've been unsubscribed." if ok else "This unsubscribe link is invalid or has expired."
    return f"""<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:60px 20px;">
    <h2>{message}</h2></body></html>"""


@router.post("/marketing/webhooks/resend", include_in_schema=False)
async def resend_webhook(request: Request):
    """Receives delivery/open/click/bounce/complaint events from Resend."""
    payload = await request.json()
    event_type = payload.get("type")
    resend_email_id = (payload.get("data") or {}).get("email_id")
    if event_type and resend_email_id:
        campaign_service.record_resend_event(event_type, resend_email_id)
    return {"status": "ok"}
