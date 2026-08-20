"""
Client Touchpoints.

Manual log of non-email contact (calls, SMS, WhatsApp, meetings) so
relationship health reflects the whole client relationship, not just
email. This is the data model + manual entry path; a real Twilio /
WhatsApp Business API integration would write into the same table.
"""
import logging
from datetime import datetime, timezone, timedelta

from database import get_supabase

logger = logging.getLogger(__name__)


def log_touchpoint(
    user_id: str,
    contact_email: str,
    channel: str,
    direction: str,
    contact_name: str | None = None,
    summary: str | None = None,
    duration_minutes: int | None = None,
    occurred_at: str | None = None,
) -> dict:
    supabase = get_supabase()
    row = {
        "user_id": user_id,
        "contact_email": contact_email.strip().lower(),
        "contact_name": contact_name,
        "channel": channel,
        "direction": direction,
        "summary": summary,
        "duration_minutes": duration_minutes,
        "occurred_at": occurred_at or datetime.now(timezone.utc).isoformat(),
    }
    result = supabase.table("client_touchpoints").insert(row).execute()
    return result.data[0] if result.data else {}


def get_touchpoints(user_id: str, contact_email: str, limit: int = 50) -> list[dict]:
    supabase = get_supabase()
    result = (
        supabase.table("client_touchpoints")
        .select("*")
        .eq("user_id", user_id)
        .eq("contact_email", contact_email.strip().lower())
        .order("occurred_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


def delete_touchpoint(touchpoint_id: str, user_id: str) -> bool:
    supabase = get_supabase()
    try:
        supabase.table("client_touchpoints").delete().eq("id", touchpoint_id).eq("user_id", user_id).execute()
        return True
    except Exception as exc:
        logger.error("delete_touchpoint error: %s", exc)
        return False


def get_touchpoints_by_contact(user_id: str, days: int = 90) -> dict[str, list[dict]]:
    """All touchpoints in the window, grouped by contact_email — used to
    fold non-email contact into relationship health scoring."""
    supabase = get_supabase()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    result = (
        supabase.table("client_touchpoints")
        .select("contact_email, occurred_at, channel, direction")
        .eq("user_id", user_id)
        .gte("occurred_at", cutoff)
        .order("occurred_at", desc=True)
        .execute()
    )
    by_contact: dict[str, list[dict]] = {}
    for row in result.data or []:
        by_contact.setdefault(row["contact_email"], []).append(row)
    return by_contact
