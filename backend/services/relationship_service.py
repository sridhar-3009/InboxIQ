"""
Client Relationship Heat Map + Sentiment Trending.
Computes health scores per contact from email history.
"""
import logging
from datetime import datetime, timezone, timedelta
from collections import defaultdict

import anthropic

from config import settings
from database import get_supabase

logger = logging.getLogger(__name__)


def _score_to_health(score: float) -> str:
    if score >= 80: return "excellent"
    if score >= 60: return "good"
    if score >= 40: return "fair"
    return "at_risk"


async def compute_relationship_scores(user_id: str) -> list[dict]:
    """Compute relationship health for all contacts of a user."""
    supabase = get_supabase()
    now = datetime.now(timezone.utc)
    cutoff_30d = (now - timedelta(days=30)).isoformat()
    cutoff_90d = (now - timedelta(days=90)).isoformat()

    result = (
        supabase.table("emails")
        .select("id, sender, received_at, category, priority, ai_summary, is_read")
        .eq("user_id", user_id)
        .neq("dismissed", True)
        .gte("received_at", cutoff_90d)
        .order("received_at", desc=True)
        .execute()
    )
    rows = result.data or []

    # Group by sender email
    by_sender: dict[str, list] = defaultdict(list)
    for row in rows:
        sender = row.get("sender", "") or ""
        if "<" in sender:
            email = sender.split("<")[-1].strip(">").strip().lower()
        else:
            email = sender.strip().lower()
        if email and "@" in email:
            by_sender[email].append(row)

    scores = []
    for email, emails in by_sender.items():
        if len(emails) < 2:
            continue

        # Parse name
        first = emails[0].get("sender", "") or ""
        name = first.split("<")[0].strip().strip('"') if "<" in first else email

        last_email = emails[0].get("received_at", "")
        try:
            last_dt = datetime.fromisoformat(last_email.replace("Z", "+00:00"))
            days_since = (now - last_dt).days
        except Exception:
            days_since = 999

        count_30d = sum(1 for e in emails if e.get("received_at", "") >= cutoff_30d)
        count_90d = len(emails)

        # Recency score (0-40): 40 if contacted today, 0 if > 30 days
        recency_score = max(0, 40 - (days_since * 1.5))

        # Frequency score (0-30): based on emails per month
        freq_score = min(30, count_30d * 6)

        # Urgency/importance score (0-20): high priority emails = important relationship
        high_priority = sum(1 for e in emails[:20] if (e.get("priority") or 0) >= 6)
        importance_score = min(20, high_priority * 4)

        # Response needed (0-10): penalize if many need_response unread
        needs_resp = sum(1 for e in emails[:10] if e.get("category") in ("needs_response", "urgent") and not e.get("is_read"))
        response_penalty = min(10, needs_resp * 3)

        health_score = int(recency_score + freq_score + importance_score - response_penalty)
        health_score = max(0, min(100, health_score))

        # Trend: compare last 30d vs previous 30d
        prev_cutoff = (now - timedelta(days=60)).isoformat()
        count_prev_30d = sum(1 for e in emails if prev_cutoff <= e.get("received_at", "") < cutoff_30d)
        if count_prev_30d == 0:
            trend = "new"
        elif count_30d > count_prev_30d * 1.2:
            trend = "growing"
        elif count_30d < count_prev_30d * 0.7:
            trend = "declining"
        else:
            trend = "stable"

        scores.append({
            "contact_email": email,
            "contact_name": name,
            "health_score": health_score,
            "health_label": _score_to_health(health_score),
            "days_since_last_email": days_since,
            "emails_30d": count_30d,
            "emails_90d": count_90d,
            "trend": trend,
            "last_email_at": last_email,
            "alert": days_since > 14 and count_30d > 2,
            "alert_message": f"No contact in {days_since} days" if days_since > 14 and count_30d > 2 else None,
        })

    scores.sort(key=lambda x: x["health_score"], reverse=True)
    return scores


async def get_email_debt(user_id: str) -> list[dict]:
    """
    Find the oldest un-replied email per contact — "you owe them a reply."

    Only considers emails that plausibly need a response (urgent /
    needs_response) and have no reply_drafts row marked as sent.
    """
    supabase = get_supabase()
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=45)).isoformat()

    emails_result = (
        supabase.table("emails")
        .select("id, sender, subject, received_at, category")
        .eq("user_id", user_id)
        .neq("dismissed", True)
        .in_("category", ["needs_response", "urgent"])
        .gte("received_at", cutoff)
        .order("received_at", desc=True)
        .execute()
    )
    emails = emails_result.data or []
    if not emails:
        return []

    email_ids = [e["id"] for e in emails]
    drafts_result = (
        supabase.table("reply_drafts")
        .select("email_id, sent")
        .in_("email_id", email_ids)
        .eq("sent", True)
        .execute()
    )
    replied_ids = {d["email_id"] for d in (drafts_result.data or [])}

    # Keep only the most recent un-replied email per sender (list is already
    # ordered newest-first, so the first hit per key wins).
    by_sender: dict[str, dict] = {}
    for e in emails:
        if e["id"] in replied_ids:
            continue
        sender = e.get("sender", "") or ""
        key = sender.split("<")[-1].strip(">").strip().lower() if "<" in sender else sender.strip().lower()
        if not key or "@" not in key:
            continue
        if key not in by_sender:
            by_sender[key] = e

    debts = []
    for key, e in by_sender.items():
        first = e.get("sender", "") or ""
        name = first.split("<")[0].strip().strip('"') if "<" in first else key
        try:
            received_dt = datetime.fromisoformat(e["received_at"].replace("Z", "+00:00"))
            days_owed = (now - received_dt).days
        except Exception:
            continue
        if days_owed < 1:
            continue
        debts.append({
            "email_id": e["id"],
            "contact_email": key,
            "contact_name": name,
            "subject": e.get("subject", ""),
            "category": e.get("category"),
            "days_owed": days_owed,
            "received_at": e.get("received_at"),
        })

    debts.sort(key=lambda x: x["days_owed"], reverse=True)
    return debts


async def get_sentiment_history(user_id: str, contact_email: str, days: int = 90) -> list[dict]:
    """Return weekly sentiment trend for a specific contact."""
    supabase = get_supabase()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    result = (
        supabase.table("emails")
        .select("id, received_at, ai_summary, priority, category")
        .eq("user_id", user_id)
        .ilike("sender", f"%{contact_email}%")
        .gte("received_at", cutoff)
        .order("received_at", desc=False)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return []

    # Group by week
    weeks: dict[str, list] = defaultdict(list)
    for row in rows:
        try:
            dt = datetime.fromisoformat(row["received_at"].replace("Z", "+00:00"))
            week_key = dt.strftime("%Y-W%W")
            weeks[week_key].append(row)
        except Exception:
            continue

    # Estimate sentiment from priority + category
    history = []
    for week, week_emails in sorted(weeks.items()):
        avg_priority = sum(e.get("priority") or 5 for e in week_emails) / len(week_emails)
        urgent_count = sum(1 for e in week_emails if e.get("category") in ("urgent", "needs_response"))
        sentiment_score = min(100, max(0, int(40 + avg_priority * 5 - urgent_count * 10)))
        history.append({
            "week": week,
            "email_count": len(week_emails),
            "sentiment_score": sentiment_score,
            "avg_priority": round(avg_priority, 1),
        })

    return history
