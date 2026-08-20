"""
Revenue Signal Extraction.
AI scans emails for: quotes, invoices, unpaid payments, renewals, upsell opportunities.
"""
import logging
import json
from datetime import datetime, timezone

import anthropic

from config import settings
from database import get_supabase

logger = logging.getLogger(__name__)

SIGNAL_TYPES = ["quote", "invoice", "unpaid", "renewal", "upsell", "opportunity", "contract"]


async def extract_revenue_signals_from_email(email_id: str, user_id: str) -> list[dict]:
    """Extract revenue signals from a single email using Claude Haiku."""
    supabase = get_supabase()
    result = supabase.table("emails").select("*").eq("id", email_id).eq("user_id", user_id).single().execute()
    email = result.data
    if not email:
        return []

    subject = email.get("subject", "") or ""
    body = (email.get("body", "") or "")[:2000]
    sender = email.get("sender", "") or ""

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    prompt = f"""Analyze this email for revenue signals. Extract any financial opportunities, obligations, or risks.

Subject: {subject}
From: {sender}
Body: {body}

Return a JSON array of signals found. Each signal:
{{
  "signal_type": "quote|invoice|unpaid|renewal|upsell|opportunity|contract",
  "description": "brief description",
  "amount": null or number (extract if mentioned),
  "currency": "INR|USD|EUR" or null,
  "due_date": "YYYY-MM-DD" or null,
  "urgency": "high|medium|low",
  "action_needed": "what the user should do"
}}

Return empty array [] if no revenue signals found. Return ONLY valid JSON, no explanation."""

    try:
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        text = next((b.text for b in response.content if b.type == "text"), "[]").strip()
        if not text.startswith("["):
            text = "[]"
        signals_raw = json.loads(text)
    except Exception as exc:
        logger.error("Revenue extraction failed for email %s: %s", email_id, exc)
        return []

    saved = []
    for sig in signals_raw[:5]:
        try:
            row = supabase.table("revenue_signals").insert({
                "user_id": user_id,
                "email_id": email_id,
                "signal_type": sig.get("signal_type", "opportunity"),
                "description": sig.get("description", ""),
                "amount": sig.get("amount"),
                "currency": sig.get("currency", "INR"),
                "due_date": sig.get("due_date"),
                "urgency": sig.get("urgency", "medium"),
                "action_needed": sig.get("action_needed", ""),
                "status": "open",
                "sender": sender,
                "subject": subject,
            }).execute()
            if row.data:
                saved.append(row.data[0])
        except Exception as exc:
            logger.error("Failed to save revenue signal: %s", exc)

    return saved


async def scan_recent_emails_for_revenue(user_id: str, limit: int = 50) -> int:
    """Background job: scan recent unscanned emails for revenue signals."""
    supabase = get_supabase()

    # Get already-scanned email IDs
    scanned = supabase.table("revenue_signals").select("email_id").eq("user_id", user_id).execute()
    scanned_ids = {r["email_id"] for r in (scanned.data or [])}

    # Get recent processed emails not yet scanned
    result = (
        supabase.table("emails")
        .select("id")
        .eq("user_id", user_id)
        .eq("processed", True)
        .neq("dismissed", True)
        .not_.in_("category", ["newsletter", "spam"])
        .order("received_at", desc=True)
        .limit(limit)
        .execute()
    )
    emails = [r for r in (result.data or []) if r["id"] not in scanned_ids]

    count = 0
    for email in emails[:20]:
        signals = await extract_revenue_signals_from_email(email["id"], user_id)
        count += len(signals)

    return count


async def get_revenue_at_risk(user_id: str) -> list[dict]:
    """
    Cross open revenue signals with relationship health: flag contacts who
    owe you money / a deal AND whose relationship is declining or at risk.
    """
    from services.relationship_service import compute_relationship_scores

    supabase = get_supabase()
    result = (
        supabase.table("revenue_signals")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "open")
        .execute()
    )
    signals = [s for s in (result.data or []) if s.get("amount")]
    if not signals:
        return []

    by_sender: dict[str, dict] = {}
    for s in signals:
        sender = (s.get("sender") or "").strip().lower()
        key = sender.split("<")[-1].strip(">").strip() if "<" in sender else sender
        if not key or "@" not in key:
            continue
        entry = by_sender.setdefault(key, {
            "contact_email": key,
            "total_amount": 0.0,
            "currency": s.get("currency") or "INR",
            "signal_count": 0,
            "signal_types": [],
        })
        entry["total_amount"] += s.get("amount") or 0
        entry["signal_count"] += 1
        if s.get("signal_type") not in entry["signal_types"]:
            entry["signal_types"].append(s.get("signal_type"))

    relationships = await compute_relationship_scores(user_id)
    rel_by_email = {r["contact_email"]: r for r in relationships}

    at_risk = []
    for key, entry in by_sender.items():
        rel = rel_by_email.get(key)
        if not rel:
            continue
        if rel["trend"] == "declining" or rel["health_label"] in ("at_risk", "fair"):
            at_risk.append({
                **entry,
                "contact_name": rel["contact_name"],
                "health_score": rel["health_score"],
                "health_label": rel["health_label"],
                "trend": rel["trend"],
                "days_since_last_email": rel["days_since_last_email"],
            })

    at_risk.sort(key=lambda x: x["total_amount"], reverse=True)
    return at_risk


def get_revenue_summary(user_id: str) -> dict:
    """Return revenue pipeline summary for dashboard widget."""
    supabase = get_supabase()
    result = (
        supabase.table("revenue_signals")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "open")
        .execute()
    )
    signals = result.data or []

    total_pipeline = sum(s.get("amount") or 0 for s in signals if s.get("amount"))
    by_type: dict[str, int] = {}
    for s in signals:
        t = s.get("signal_type", "other")
        by_type[t] = by_type.get(t, 0) + 1

    high_urgency = [s for s in signals if s.get("urgency") == "high"]

    return {
        "total_signals": len(signals),
        "total_pipeline_value": total_pipeline,
        "by_type": by_type,
        "high_urgency_count": len(high_urgency),
        "high_urgency": high_urgency[:5],
        "signals": signals[:20],
    }
