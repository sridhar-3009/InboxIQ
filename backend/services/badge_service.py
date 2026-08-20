"""
Public response-time trust badge.

Renders a shields.io-style SVG badge showing a user's average email
response time, computed from real sent-reply timestamps. Opt-in only
(user_profiles.badge_enabled) so nothing is exposed by default.
"""
import logging
from datetime import datetime, timezone, timedelta

from database import get_supabase

logger = logging.getLogger(__name__)

MIN_SAMPLES_FOR_BADGE = 3


def compute_avg_response_hours(user_id: str) -> dict:
    supabase = get_supabase()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()

    drafts_result = (
        supabase.table("reply_drafts")
        .select("email_id, sent_at")
        .eq("user_id", user_id)
        .eq("sent", True)
        .gte("sent_at", cutoff)
        .execute()
    )
    drafts = drafts_result.data or []
    if not drafts:
        return {"avg_hours": None, "sample_size": 0}

    email_ids = [d["email_id"] for d in drafts if d.get("email_id")]
    if not email_ids:
        return {"avg_hours": None, "sample_size": 0}

    emails_result = (
        supabase.table("emails")
        .select("id, received_at")
        .in_("id", email_ids)
        .execute()
    )
    received_by_id = {e["id"]: e["received_at"] for e in (emails_result.data or [])}

    deltas = []
    for d in drafts:
        received = received_by_id.get(d.get("email_id"))
        sent_at = d.get("sent_at")
        if not received or not sent_at:
            continue
        try:
            r_dt = datetime.fromisoformat(received.replace("Z", "+00:00"))
            s_dt = datetime.fromisoformat(sent_at.replace("Z", "+00:00"))
            hours = (s_dt - r_dt).total_seconds() / 3600
            if 0 <= hours <= 24 * 14:  # ignore outliers older than 2 weeks (likely backfilled/reopened)
                deltas.append(hours)
        except Exception:
            continue

    if not deltas:
        return {"avg_hours": None, "sample_size": 0}

    return {"avg_hours": round(sum(deltas) / len(deltas), 1), "sample_size": len(deltas)}


def _format_duration(hours: float) -> str:
    if hours < 1:
        return f"{max(1, round(hours * 60))}m"
    if hours < 24:
        return f"{round(hours)}h"
    return f"{round(hours / 24, 1)}d"


def _svg_badge(label: str, value: str, color: str) -> str:
    label_w = 7 * len(label) + 20
    value_w = 7 * len(value) + 20
    total_w = label_w + value_w
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{total_w}" height="20" role="img" aria-label="{label}: {value}">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="{total_w}" height="20" rx="4" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="{label_w}" height="20" fill="#4a4033"/>
    <rect x="{label_w}" width="{value_w}" height="20" fill="{color}"/>
    <rect width="{total_w}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="{label_w / 2}" y="14">{label}</text>
    <text x="{label_w + value_w / 2}" y="14">{value}</text>
  </g>
</svg>'''


def generate_response_time_badge_svg(user_id: str) -> str:
    supabase = get_supabase()
    try:
        profile = (
            supabase.table("user_profiles")
            .select("badge_enabled")
            .eq("id", user_id)
            .single()
            .execute()
        )
        enabled = bool(profile.data and profile.data.get("badge_enabled"))
    except Exception as exc:
        logger.warning("badge_enabled lookup failed (migration applied?): %s", exc)
        enabled = False

    if not enabled:
        return _svg_badge("response time", "private", "#a99b83")

    stats = compute_avg_response_hours(user_id)
    if not stats["avg_hours"] or stats["sample_size"] < MIN_SAMPLES_FOR_BADGE:
        return _svg_badge("response time", "gathering data", "#a99b83")

    return _svg_badge("avg response time", _format_duration(stats["avg_hours"]), "#b04723")
