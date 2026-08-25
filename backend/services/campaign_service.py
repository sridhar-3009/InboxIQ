"""
Email marketing: audiences, campaigns, sending via Resend, and
monthly send-volume enforcement against the org's marketing plan.
"""
import logging
from datetime import datetime, timezone

import httpx

from config import settings
from database import get_supabase

logger = logging.getLogger(__name__)

RESEND_API = "https://api.resend.com/emails"

# Monthly email-send limits per plan. Keep in sync with pricing shown on
# the campaigns page — these are enforced here, not just displayed.
PLAN_LIMITS = {
    "free": 1000,
    "growth": 10000,
    "scale": 50000,
    "pro": 200000,
}


def _period() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def get_usage(org_id: str) -> dict:
    supabase = get_supabase()
    plan_row = supabase.table("organizations").select("marketing_plan").eq("id", org_id).single().execute()
    plan = (plan_row.data or {}).get("marketing_plan", "free")
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])

    period = _period()
    usage_row = (
        supabase.table("marketing_usage")
        .select("emails_sent")
        .eq("org_id", org_id)
        .eq("period", period)
        .maybe_single()
        .execute()
    )
    sent = (usage_row.data or {}).get("emails_sent", 0) if usage_row else 0

    return {"plan": plan, "limit": limit, "sent": sent, "remaining": max(0, limit - sent), "period": period}


def _increment_usage(org_id: str, count: int) -> None:
    supabase = get_supabase()
    period = _period()
    existing = (
        supabase.table("marketing_usage")
        .select("emails_sent")
        .eq("org_id", org_id)
        .eq("period", period)
        .maybe_single()
        .execute()
    )
    if existing and existing.data:
        supabase.table("marketing_usage").update(
            {"emails_sent": existing.data["emails_sent"] + count}
        ).eq("org_id", org_id).eq("period", period).execute()
    else:
        supabase.table("marketing_usage").insert(
            {"org_id": org_id, "period": period, "emails_sent": count}
        ).execute()


def is_suppressed(org_id: str, email: str) -> bool:
    supabase = get_supabase()
    row = (
        supabase.table("marketing_suppressions")
        .select("id")
        .eq("org_id", org_id)
        .eq("email", email.lower())
        .maybe_single()
        .execute()
    )
    return bool(row and row.data)


async def _send_one(to: str, subject: str, html: str, from_name: str | None, tags: list[dict]) -> str | None:
    """Returns the Resend email id on success, None on failure."""
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — cannot send campaign email")
        return None
    sender = f"{from_name} <campaigns@mailair.company>" if from_name else "Mailair <campaigns@mailair.company>"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                RESEND_API,
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={"from": sender, "to": [to], "subject": subject, "html": html, "tags": tags},
            )
            if resp.status_code not in (200, 201):
                logger.error("Resend send error %s: %s", resp.status_code, resp.text)
                return None
            return resp.json().get("id")
    except Exception as exc:
        logger.error("Campaign send error to %s: %s", to, exc)
        return None


def _unsubscribe_footer(unsubscribe_url: str) -> str:
    return (
        f'<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e2e2;'
        f'font-size:11px;color:#888;">'
        f'You are receiving this because you are on a mailing list. '
        f'<a href="{unsubscribe_url}" style="color:#888;">Unsubscribe</a></div>'
    )


async def send_campaign(campaign_id: str) -> dict:
    """
    Sends a draft campaign to every subscribed, non-suppressed contact in its
    audience, enforcing the org's monthly plan limit. Partial sends are
    allowed (send until the limit is hit, then stop and report how many
    went out) rather than an all-or-nothing failure.
    """
    supabase = get_supabase()

    campaign_row = supabase.table("marketing_campaigns").select("*").eq("id", campaign_id).single().execute()
    campaign = campaign_row.data
    if not campaign:
        raise ValueError("Campaign not found.")
    if campaign["status"] not in ("draft", "failed"):
        raise ValueError(f"Campaign is already {campaign['status']}.")

    org_id = campaign["org_id"]
    usage = get_usage(org_id)

    contacts_row = (
        supabase.table("marketing_audience_contacts")
        .select("email, name, unsubscribe_token")
        .eq("audience_id", campaign["audience_id"])
        .eq("subscribed", True)
        .execute()
    )
    contacts = contacts_row.data or []
    eligible = [c for c in contacts if not is_suppressed(org_id, c["email"])]

    supabase.table("marketing_campaigns").update({"status": "sending"}).eq("id", campaign_id).execute()

    sent_count = 0
    failed_count = 0
    limit_hit = False

    for contact in eligible:
        if usage["remaining"] - sent_count <= 0:
            limit_hit = True
            break

        unsubscribe_url = f"{settings.BACKEND_URL}/api/marketing/unsubscribe?token={contact['unsubscribe_token']}"
        html = campaign["body_html"] + _unsubscribe_footer(unsubscribe_url)

        resend_id = await _send_one(
            contact["email"], campaign["subject"], html, campaign.get("from_name"),
            tags=[{"name": "campaign_id", "value": campaign_id}],
        )

        status_val = "sent" if resend_id else "failed"
        supabase.table("marketing_campaign_recipients").upsert(
            {
                "campaign_id": campaign_id,
                "email": contact["email"],
                "status": status_val,
                "resend_email_id": resend_id,
                "sent_at": datetime.now(timezone.utc).isoformat() if resend_id else None,
            },
            on_conflict="campaign_id,email",
        ).execute()

        if resend_id:
            sent_count += 1
        else:
            failed_count += 1

    if sent_count:
        _increment_usage(org_id, sent_count)

    final_status = "sent" if not limit_hit else "failed"
    supabase.table("marketing_campaigns").update(
        {"status": final_status, "sent_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", campaign_id).execute()

    return {
        "sent": sent_count,
        "failed": failed_count,
        "skipped_over_limit": len(eligible) - sent_count - failed_count if limit_hit else 0,
        "status": final_status,
    }


def unsubscribe_by_token(token: str) -> bool:
    supabase = get_supabase()
    row = (
        supabase.table("marketing_audience_contacts")
        .select("id, audience_id, email")
        .eq("unsubscribe_token", token)
        .maybe_single()
        .execute()
    )
    if not row or not row.data:
        return False

    contact = row.data
    supabase.table("marketing_audience_contacts").update(
        {"subscribed": False, "unsubscribed_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", contact["id"]).execute()

    audience = supabase.table("marketing_audiences").select("org_id").eq("id", contact["audience_id"]).single().execute()
    org_id = (audience.data or {}).get("org_id")
    if org_id:
        supabase.table("marketing_suppressions").upsert(
            {"org_id": org_id, "email": contact["email"], "reason": "unsubscribed"},
            on_conflict="org_id,email",
        ).execute()
    return True


def record_resend_event(event_type: str, resend_email_id: str) -> None:
    """Called from the Resend webhook to update open/click/bounce state."""
    supabase = get_supabase()
    field_map = {
        "email.opened": ("opened", "opened_at"),
        "email.clicked": ("clicked", "clicked_at"),
        "email.bounced": ("bounced", None),
        "email.complained": ("complained", None),
    }
    mapped = field_map.get(event_type)
    if not mapped:
        return
    status_val, timestamp_field = mapped

    update = {"status": status_val}
    if timestamp_field:
        update[timestamp_field] = datetime.now(timezone.utc).isoformat()

    supabase.table("marketing_campaign_recipients").update(update).eq("resend_email_id", resend_email_id).execute()

    if event_type in ("email.bounced", "email.complained"):
        recipient = (
            supabase.table("marketing_campaign_recipients")
            .select("email, campaign_id")
            .eq("resend_email_id", resend_email_id)
            .maybe_single()
            .execute()
        )
        if recipient and recipient.data:
            campaign = (
                supabase.table("marketing_campaigns")
                .select("org_id")
                .eq("id", recipient.data["campaign_id"])
                .single()
                .execute()
            )
            org_id = (campaign.data or {}).get("org_id")
            if org_id:
                reason = "bounced" if event_type == "email.bounced" else "complained"
                supabase.table("marketing_suppressions").upsert(
                    {"org_id": org_id, "email": recipient.data["email"], "reason": reason},
                    on_conflict="org_id,email",
                ).execute()
