"""
In-app notifications — powers the navbar bell (previously a static
placeholder) and used by chat @mentions and the email-debt reminder.
"""
import logging

from database import get_supabase

logger = logging.getLogger(__name__)


def create_notification(
    user_id: str,
    title: str,
    body: str | None = None,
    org_id: str | None = None,
    notif_type: str = "general",
    link: str | None = None,
) -> dict:
    try:
        supabase = get_supabase()
        result = supabase.table("notifications").insert({
            "user_id": user_id,
            "org_id": org_id,
            "type": notif_type,
            "title": title,
            "body": body,
            "link": link,
        }).execute()
        return result.data[0] if result.data else {}
    except Exception as exc:
        logger.warning("create_notification failed for user %s: %s", user_id, exc)
        return {}


def list_notifications(user_id: str, limit: int = 30) -> list[dict]:
    supabase = get_supabase()
    result = (
        supabase.table("notifications")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


def unread_count(user_id: str) -> int:
    supabase = get_supabase()
    result = (
        supabase.table("notifications")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("is_read", False)
        .execute()
    )
    return result.count or 0


def mark_read(notification_id: str, user_id: str) -> bool:
    supabase = get_supabase()
    result = supabase.table("notifications").update({"is_read": True}).eq("id", notification_id).eq("user_id", user_id).execute()
    return bool(result.data)


def mark_all_read(user_id: str) -> None:
    supabase = get_supabase()
    supabase.table("notifications").update({"is_read": True}).eq("user_id", user_id).eq("is_read", False).execute()
