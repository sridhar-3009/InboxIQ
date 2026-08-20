"""
Voice Match Score.

Measures how close the AI's reply drafts land to what the user actually
sends, using the real edit distance between draft_text (what AI wrote)
and edited_text/final sent text (what the user kept). This is a real,
observable signal — not a modeled guess — so the score is honest and
naturally improves as the user's tone profile gets more sent replies to
learn from.
"""
import logging
from difflib import SequenceMatcher
from datetime import datetime, timezone, timedelta

from database import get_supabase

logger = logging.getLogger(__name__)

MIN_SAMPLES_FOR_SCORE = 2
TREND_WINDOW = 10


def _similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


async def get_voice_match_summary(user_id: str) -> dict:
    """
    Returns the user's current AI voice-match score, trend, and a small
    chronological history suitable for a sparkline.
    """
    supabase = get_supabase()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=120)).isoformat()

    result = (
        supabase.table("reply_drafts")
        .select("draft_text, edited_text, sent, sent_at")
        .eq("user_id", user_id)
        .eq("sent", True)
        .gte("sent_at", cutoff)
        .order("sent_at", desc=True)
        .limit(40)
        .execute()
    )
    rows = result.data or []

    scored = []
    for r in rows:
        original = r.get("draft_text") or ""
        final_text = r.get("edited_text") or original
        if not original:
            continue
        scored.append({
            "sent_at": r.get("sent_at"),
            "score": round(_similarity(original, final_text) * 100),
        })

    if len(scored) < MIN_SAMPLES_FOR_SCORE:
        return {
            "score": None,
            "trend": "new",
            "samples": len(scored),
            "history": list(reversed(scored)),
            "message": "Send a few AI-drafted replies and we'll show how closely they match your voice.",
        }

    recent = scored[:TREND_WINDOW]
    older = scored[TREND_WINDOW:TREND_WINDOW * 2]
    recent_avg = sum(s["score"] for s in recent) / len(recent)

    if older:
        older_avg = sum(s["score"] for s in older) / len(older)
        delta = recent_avg - older_avg
        trend = "improving" if delta > 3 else "declining" if delta < -3 else "steady"
    else:
        trend = "new"

    return {
        "score": round(recent_avg),
        "trend": trend,
        "samples": len(scored),
        "history": list(reversed(scored[:12])),
        "message": None,
    }
