import csv
import io
import logging
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from database import get_supabase
from middleware.auth import get_current_user
from models.email import EmailFilter, EmailResponse
from services import email_service
from services.ai_processor import process_email
from services.gmail_service import send_gmail_reply, get_email_attachments, get_attachment_data
from services.razorpay_service import PLAN_LIMITS
from services.voice_match_service import get_voice_match_summary
from workers.email_listener import _process_user_emails

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/emails", tags=["emails"])


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _current_user_id(current_user: dict) -> str:
    return current_user["id"]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("", response_model=dict)
async def list_emails(
    current_user: Annotated[dict, Depends(get_current_user)],
    category: str | None = Query(None),
    priority_level: str | None = Query(None),
    min_priority: int | None = Query(None, ge=1, le=10),
    is_read: bool | None = Query(None),
    processed: bool | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    sort_by: str | None = Query(None),
    sort_order: str | None = Query(None),
):
    """List emails for the authenticated user with optional filters."""
    offset = (page - 1) * page_size
    filters = EmailFilter(
        category=category,
        min_priority=min_priority,
        processed=processed,
        limit=page_size,
        offset=offset,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    items = await email_service.get_emails(
        user_id=_current_user_id(current_user), filters=filters
    )
    total = await email_service.count_emails(
        user_id=_current_user_id(current_user), filters=filters
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/analytics")
async def email_analytics(current_user: Annotated[dict, Depends(get_current_user)]):
    """Return analytics data for charts."""
    return await email_service.get_analytics(user_id=_current_user_id(current_user))


async def _get_emails_used_this_month(user_id: str) -> int:
    """Count AI-processed emails this calendar month for plan limit enforcement."""
    from datetime import timezone
    supabase = get_supabase()
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    result = (
        supabase.table("emails")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("processed", True)
        .gte("created_at", month_start)
        .execute()
    )
    return result.count or 0


async def _get_user_plan(user_id: str) -> str:
    supabase = get_supabase()
    result = supabase.table("user_profiles").select("plan").eq("id", user_id).single().execute()
    return (result.data or {}).get("plan", "free")


@router.post("/bulk-process", status_code=status.HTTP_202_ACCEPTED)
async def bulk_process_emails(
    background_tasks: BackgroundTasks,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Queue AI processing for all unprocessed emails, respecting plan limits."""
    user_id = _current_user_id(current_user)
    plan = await _get_user_plan(user_id)
    limit = PLAN_LIMITS.get(plan)  # None = unlimited

    email_ids = await email_service.get_unprocessed_email_ids(user_id=user_id)

    if limit is not None:
        used = await _get_emails_used_this_month(user_id)
        remaining = max(0, limit - used)
        email_ids = email_ids[:remaining]
        if not email_ids:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Monthly limit of {limit} emails reached. Upgrade to Pro for unlimited processing.",
            )

    for email_id in email_ids:
        email = await email_service.get_email(email_id=email_id, user_id=user_id)
        if email:
            background_tasks.add_task(process_email, email)
    return {"message": f"Queued {len(email_ids)} emails for AI processing.", "count": len(email_ids)}


@router.patch("/{email_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_as_read(
    email_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Mark an email as read."""
    await email_service.mark_email_read(email_id=email_id, user_id=_current_user_id(current_user))
    return None


@router.get("/stats")
async def email_stats(current_user: Annotated[dict, Depends(get_current_user)]):
    """Return aggregate email statistics for the current user."""
    return await email_service.get_email_stats(
        user_id=_current_user_id(current_user)
    )


@router.get("/priority-inbox")
async def priority_inbox(current_user: Annotated[dict, Depends(get_current_user)]):
    """Return emails organised into urgent / important / other sections."""
    return await email_service.get_priority_inbox(
        user_id=_current_user_id(current_user)
    )


@router.post("/sync", status_code=status.HTTP_202_ACCEPTED)
async def sync_emails(
    background_tasks: BackgroundTasks,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Manually trigger a Gmail sync for the current user."""
    background_tasks.add_task(_process_user_emails, _current_user_id(current_user))
    return {"message": "Gmail sync started."}


@router.get("/sync/debug")
async def sync_debug(current_user: Annotated[dict, Depends(get_current_user)]):
    """Debug endpoint: runs sync synchronously and returns what was fetched."""
    from services.gmail_service import fetch_new_emails, get_gmail_tokens
    user_id = _current_user_id(current_user)
    try:
        tokens = await get_gmail_tokens(user_id)
        if not tokens:
            return {"error": "No Gmail tokens found", "user_id": user_id}
        raw = await fetch_new_emails(user_id=user_id)
        return {
            "gmail_address": tokens.get("gmail_address"),
            "emails_found": len(raw),
            "subjects": [e.get("subject") for e in raw[:10]],
        }
    except Exception as exc:
        return {"error": str(exc), "type": type(exc).__name__}


# ---------------------------------------------------------------------------
# New feature models
# ---------------------------------------------------------------------------

class StarBody(BaseModel):
    starred: bool


class SnoozeBody(BaseModel):
    snooze_until: datetime | None = None


class FollowUpBody(BaseModel):
    waiting: bool


class PinBody(BaseModel):
    pinned: bool


class MuteBody(BaseModel):
    muted: bool


class ComposeBody(BaseModel):
    to: str
    subject: str
    body: str


class BulkEmailIds(BaseModel):
    email_ids: list[str]


class QuoteRequest(BaseModel):
    project_description: str | None = None
    budget_hint: str | None = None


# ---------------------------------------------------------------------------
# New feature routes (must be before /{email_id} catch-all)
# ---------------------------------------------------------------------------

@router.patch("/{email_id}/star", status_code=status.HTTP_204_NO_CONTENT)
async def star_email(
    email_id: str,
    body: StarBody,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Toggle the starred flag on an email."""
    await email_service.toggle_star(
        email_id=email_id,
        user_id=_current_user_id(current_user),
        starred=body.starred,
    )
    return None


@router.patch("/{email_id}/snooze", status_code=status.HTTP_204_NO_CONTENT)
async def snooze_email(
    email_id: str,
    body: SnoozeBody,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Set or clear the snooze_until timestamp on an email."""
    await email_service.snooze_email(
        email_id=email_id,
        user_id=_current_user_id(current_user),
        snooze_until=body.snooze_until,
    )
    return None


@router.patch("/{email_id}/follow-up", status_code=status.HTTP_204_NO_CONTENT)
async def toggle_follow_up(
    email_id: str,
    body: FollowUpBody,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Set or clear the __followup__ label on an email."""
    supabase = get_supabase()
    user_id = _current_user_id(current_user)
    row = (
        supabase.table("emails")
        .select("labels")
        .eq("id", email_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found.")
    labels: list = list(row.data.get("labels") or [])
    if body.waiting:
        if "__followup__" not in labels:
            labels.append("__followup__")
    else:
        labels = [l for l in labels if l != "__followup__"]
    supabase.table("emails").update({"labels": labels}).eq("id", email_id).eq("user_id", user_id).execute()
    return None


@router.patch("/{email_id}/pin", status_code=status.HTTP_204_NO_CONTENT)
async def pin_email(
    email_id: str,
    body: PinBody,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Toggle the __pinned__ label on an email."""
    supabase = get_supabase()
    user_id = _current_user_id(current_user)
    row = supabase.table("emails").select("labels").eq("id", email_id).eq("user_id", user_id).single().execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Email not found.")
    labels: list = list(row.data.get("labels") or [])
    if body.pinned:
        if "__pinned__" not in labels:
            labels.append("__pinned__")
    else:
        labels = [l for l in labels if l != "__pinned__"]
    supabase.table("emails").update({"labels": labels}).eq("id", email_id).eq("user_id", user_id).execute()
    return None


@router.patch("/{email_id}/mute", status_code=status.HTTP_204_NO_CONTENT)
async def mute_sender(
    email_id: str,
    body: MuteBody,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Add/remove the email's sender from the user's sync_sender_blocklist."""
    supabase = get_supabase()
    user_id = _current_user_id(current_user)
    email_row = supabase.table("emails").select("sender").eq("id", email_id).eq("user_id", user_id).single().execute()
    if not email_row.data:
        raise HTTPException(status_code=404, detail="Email not found.")
    sender = email_row.data.get("sender", "")
    profile = supabase.table("user_profiles").select("sync_sender_blocklist").eq("id", user_id).single().execute()
    blocklist: list = list((profile.data or {}).get("sync_sender_blocklist") or [])
    if body.muted:
        if sender not in blocklist:
            blocklist.append(sender)
    else:
        blocklist = [s for s in blocklist if s != sender]
    supabase.table("user_profiles").update({"sync_sender_blocklist": blocklist}).eq("id", user_id).execute()
    return None


@router.post("/{email_id}/smart-replies", response_model=dict)
async def get_smart_replies(
    email_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Generate 3 short one-click reply suggestions for an email."""
    import anthropic as _anthropic
    from config import settings as _settings
    user_id = _current_user_id(current_user)
    supabase = get_supabase()
    row = supabase.table("emails").select("subject, sender, body, ai_summary").eq("id", email_id).eq("user_id", user_id).single().execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Email not found.")
    e = row.data
    prompt = (
        f"Email from {e.get('sender','')}: Subject: {e.get('subject','')}\n"
        f"Body: {(e.get('body') or e.get('ai_summary',''))[:800]}\n\n"
        "Generate exactly 3 short reply suggestions (each under 20 words). "
        "Return JSON array of strings only, no explanation. "
        'Example: ["Thanks, I\'ll review and get back to you.", "Can we schedule a call to discuss?", "Got it, will do!"]'
    )
    try:
        client = _anthropic.AsyncAnthropic(api_key=_settings.ANTHROPIC_API_KEY)
        resp = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}],
        )
        import json, re
        text = resp.content[0].text if resp.content else "[]"
        match = re.search(r'\[.*\]', text, re.DOTALL)
        suggestions = json.loads(match.group()) if match else []
        return {"suggestions": suggestions[:3]}
    except Exception as exc:
        logger.error("smart_replies error: %s", exc)
        return {"suggestions": ["Thanks for reaching out!", "I'll get back to you soon.", "Sounds good, let's connect."]}


@router.post("/compose", response_model=dict)
async def compose_email(
    body: ComposeBody,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Send a new email via Gmail (not a reply)."""
    user_id = _current_user_id(current_user)
    from services.gmail_service import send_gmail_reply as _send
    success = await _send(
        user_id=user_id,
        thread_id="",
        to=body.to,
        subject=body.subject,
        body=body.body,
    )
    if not success:
        raise HTTPException(status_code=502, detail="Failed to send email. Check Gmail connection.")
    return {"success": True}


@router.post("/inbox-zero", response_model=dict)
async def inbox_zero(current_user: Annotated[dict, Depends(get_current_user)]):
    """Dismiss newsletters, spam, and low-priority FYI emails to reach Inbox Zero."""
    result = await email_service.inbox_zero(user_id=_current_user_id(current_user))
    return result


@router.post("/bulk-summarize", response_model=list)
async def bulk_summarize(
    body: BulkEmailIds,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Generate AI summaries for multiple emails (cap 10)."""
    summaries = await email_service.bulk_summarize(
        user_id=_current_user_id(current_user), email_ids=body.email_ids
    )
    return summaries


@router.get("/snoozed")
async def get_snoozed_emails(current_user: Annotated[dict, Depends(get_current_user)]):
    """Return emails that are currently snoozed (snooze_until in the future)."""
    return await email_service.get_snoozed_emails(user_id=_current_user_id(current_user))


@router.post("/bulk-dismiss")
async def bulk_dismiss(
    body: BulkEmailIds,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Set dismissed=true on all given email IDs."""
    count = await email_service.bulk_dismiss(
        user_id=_current_user_id(current_user), email_ids=body.email_ids
    )
    return {"dismissed": count}


@router.post("/bulk-read")
async def bulk_mark_read(
    body: BulkEmailIds,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Set is_read=true on all given email IDs."""
    count = await email_service.bulk_mark_read(
        user_id=_current_user_id(current_user), email_ids=body.email_ids
    )
    return {"updated": count}


@router.get("/thread/{thread_id}", response_model=list)
async def get_thread(
    thread_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Return all emails in a Gmail thread, oldest first."""
    supabase = get_supabase()
    user_id = _current_user_id(current_user)
    result = (
        supabase.table("emails")
        .select("*")
        .eq("user_id", user_id)
        .eq("gmail_thread_id", thread_id)
        .order("received_at", desc=False)
        .execute()
    )
    return result.data or []


@router.get("/export")
async def export_emails_csv(current_user: Annotated[dict, Depends(get_current_user)]):
    """Export all non-dismissed emails as a CSV file."""
    rows = await email_service.get_export_emails(user_id=_current_user_id(current_user))

    output = io.StringIO()
    fieldnames = ["id", "subject", "sender", "received_at", "category", "priority",
                  "ai_summary", "is_read", "processed"]
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="emails.csv"'},
    )


@router.get("/sender-insights")
async def sender_insights(current_user: Annotated[dict, Depends(get_current_user)]):
    """Return top 10 senders by email count with category breakdown."""
    return await email_service.get_sender_insights(user_id=_current_user_id(current_user))


@router.get("/recurring-senders")
async def recurring_senders(current_user: Annotated[dict, Depends(get_current_user)]):
    """Return senders with 3+ emails in the last 30 days mapped to their count."""
    from datetime import timedelta, timezone
    from collections import Counter
    supabase = get_supabase()
    user_id = _current_user_id(current_user)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    result = (
        supabase.table("emails")
        .select("sender")
        .eq("user_id", user_id)
        .gte("received_at", cutoff)
        .execute()
    )
    counts = Counter(r.get("sender", "") for r in (result.data or []) if r.get("sender"))
    return {sender: count for sender, count in counts.items() if count >= 3}


class BulkCategorizeBody(BaseModel):
    email_ids: list[str]
    category: str


@router.post("/bulk-categorize")
async def bulk_categorize(
    body: BulkCategorizeBody,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Override the category field on multiple emails."""
    supabase = get_supabase()
    user_id = _current_user_id(current_user)
    updated = 0
    for email_id in body.email_ids:
        result = (
            supabase.table("emails")
            .update({"category": body.category})
            .eq("id", email_id)
            .eq("user_id", user_id)
            .execute()
        )
        if result.data:
            updated += len(result.data)
    return {"updated": updated}


@router.post("/mark-all-read")
async def mark_all_read(
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Mark all unread emails for this user as read."""
    supabase = get_supabase()
    user_id = _current_user_id(current_user)
    result = (
        supabase.table("emails")
        .update({"is_read": True})
        .eq("user_id", user_id)
        .eq("is_read", False)
        .execute()
    )
    return {"updated": len(result.data or [])}


@router.get("/follow-ups")
async def follow_ups(current_user: Annotated[dict, Depends(get_current_user)]):
    """Return processed emails needing follow-up older than 2 days."""
    return await email_service.get_follow_up_emails(user_id=_current_user_id(current_user))


@router.get("/response-time", response_model=dict)
async def get_response_time_analytics(current_user: Annotated[dict, Depends(get_current_user)]):
    """Returns avg response time (hours) per category + 30-day daily trend."""
    try:
        from datetime import datetime, timezone
        supabase = get_supabase()
        user_id = _current_user_id(current_user)

        result = supabase.table("emails").select(
            "id, received_at, category, reply_drafts(created_at)"
        ).eq("user_id", user_id).execute()

        rows = result.data or []
        by_category: dict[str, list[float]] = {}
        daily: dict[str, list[float]] = {}
        all_times: list[float] = []

        for row in rows:
            drafts = row.get("reply_drafts") or []
            if not drafts:
                continue
            received = row.get("received_at")
            first_draft = drafts[0].get("created_at") if isinstance(drafts, list) else None
            if not received or not first_draft:
                continue
            try:
                t_recv = datetime.fromisoformat(received.replace("Z", "+00:00"))
                t_draft = datetime.fromisoformat(first_draft.replace("Z", "+00:00"))
                delta_h = (t_draft - t_recv).total_seconds() / 3600
                if delta_h < 0 or delta_h > 720:
                    continue
                all_times.append(delta_h)
                cat = row.get("category") or "other"
                by_category.setdefault(cat, []).append(delta_h)
                day = t_recv.strftime("%Y-%m-%d")
                daily.setdefault(day, []).append(delta_h)
            except Exception:
                continue

        def avg(lst: list[float]) -> float:
            return round(sum(lst) / len(lst), 2) if lst else 0.0

        return {
            "overall_avg_hours": avg(all_times),
            "by_category": {k: avg(v) for k, v in by_category.items()},
            "daily_trend": [
                {"day": d, "avg_hours": avg(v)}
                for d, v in sorted(daily.items())[-30:]
            ],
            "total_replied": len(all_times),
        }
    except Exception as exc:
        logger.error("response_time_analytics error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to get response time analytics.")


@router.post("/{email_id}/generate-quote", response_model=dict)
async def generate_quote(
    email_id: str,
    body: QuoteRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Generate a structured project quote/proposal for a quote_request email."""
    try:
        supabase = get_supabase()
        user_id = _current_user_id(current_user)

        email = supabase.table("emails").select(
            "id, subject, sender, body, category, user_id"
        ).eq("id", email_id).eq("user_id", user_id).single().execute()

        if not email.data:
            raise HTTPException(status_code=404, detail="Email not found.")

        e = email.data

        # Get company description from user profile
        profile = supabase.table("user_profiles").select(
            "company_description"
        ).eq("id", user_id).single().execute()
        company_description = (profile.data or {}).get("company_description", "a professional service business")

        from ai.classifier import client as ai_client

        quote_prompt = f"""You are a professional business consultant helping generate a project quote/proposal.

Business: {company_description}

Client Request Email:
Subject: {e.get('subject', '')}
From: {e.get('sender', '')}
Body: {e.get('body', '')[:2000]}

{f"Additional context: {body.project_description}" if body.project_description else ""}
{f"Budget hint: {body.budget_hint}" if body.budget_hint else ""}

Generate a professional project quote. Return ONLY a JSON object with these fields:
- project_title: string (short project name)
- project_description: string (2-3 sentence description of what will be delivered)
- deliverables: array of strings (3-6 specific deliverables)
- timeline: string (e.g. "2-3 weeks")
- price_estimate: string (e.g. "$500 - $800" or "Custom pricing based on scope")
- payment_terms: string (e.g. "50% upfront, 50% on delivery")
- validity: string (e.g. "This quote is valid for 30 days")
- notes: string (any important notes or assumptions)"""

        response = await ai_client.messages.create(
            model="claude-opus-4-6",
            max_tokens=800,
            messages=[{"role": "user", "content": quote_prompt}],
        )

        text = next((b.text for b in response.content if b.type == "text"), None)
        if not text:
            raise ValueError("No response from AI")

        raw = text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        import json
        quote = json.loads(raw)
        return {"quote": quote, "email_id": email_id}

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("generate_quote error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to generate quote.")


@router.get("/{email_id}/meeting-info", response_model=dict)
async def detect_meeting_info(
    email_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Detect if email contains a meeting request and extract meeting details."""
    try:
        supabase = get_supabase()
        user_id = _current_user_id(current_user)

        email = supabase.table("emails").select(
            "id, subject, sender, body"
        ).eq("id", email_id).eq("user_id", user_id).single().execute()

        if not email.data:
            raise HTTPException(status_code=404, detail="Email not found.")

        e = email.data

        from ai.classifier import client as ai_client
        import json

        detect_prompt = f"""Analyze this email and determine if it contains a meeting request.

Email Subject: {e.get('subject', '')}
From: {e.get('sender', '')}
Body: {e.get('body', '')[:1500]}

Return ONLY a JSON object with these fields:
- is_meeting_request: boolean
- meeting_type: string or null ("call", "video", "in_person", "demo", "interview", "other")
- proposed_times: array of strings (any specific times mentioned, e.g. ["Monday 2pm", "Tuesday morning"])
- duration_hint: string or null (e.g. "30 minutes", "1 hour")
- agenda: string or null (what the meeting is about, 1 sentence)
- suggested_reply_snippet: string or null (a brief suggested reply to confirm the meeting, 2-3 sentences)"""

        response = await ai_client.messages.create(
            model="claude-opus-4-6",
            max_tokens=400,
            messages=[{"role": "user", "content": detect_prompt}],
        )

        text = next((b.text for b in response.content if b.type == "text"), None)
        raw = (text or "{}").strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        result = json.loads(raw.strip())
        return result

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("detect_meeting_info error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to detect meeting info.")


@router.post("/{email_id}/forward-to-slack", response_model=dict)
async def forward_to_slack(
    email_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Forward an email's AI summary + key details to the user's Slack webhook."""
    from services.slack_service import send_slack_notification
    user_id = _current_user_id(current_user)
    supabase = get_supabase()

    # Get email
    email_row = supabase.table("emails").select(
        "subject, sender, ai_summary, category, priority, received_at"
    ).eq("id", email_id).eq("user_id", user_id).single().execute()
    if not email_row.data:
        raise HTTPException(status_code=404, detail="Email not found.")
    e = email_row.data

    # Get user's Slack webhook
    profile = supabase.table("user_profiles").select("slack_webhook_url").eq("id", user_id).single().execute()
    webhook_url = (profile.data or {}).get("slack_webhook_url", "").strip()
    if not webhook_url:
        raise HTTPException(status_code=400, detail="No Slack webhook configured. Add one in Settings → Integrations.")

    priority = e.get("priority") or 0
    priority_emoji = "🔴" if priority >= 8 else "🟠" if priority >= 5 else "🟢"
    message = (
        f"{priority_emoji} *Forwarded from Mailair*\n"
        f"*Subject:* {e.get('subject', '(No Subject)')}\n"
        f"*From:* {e.get('sender', '')}\n"
        f"*Category:* {e.get('category', 'Unknown')} | *Priority:* {priority}/10\n"
    )
    if e.get("ai_summary"):
        message += f"*AI Summary:* {e['ai_summary']}\n"

    ok = await send_slack_notification(webhook_url, message)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to send Slack message.")
    return {"ok": True}


class AskAIBody(BaseModel):
    question: str


@router.post("/{email_id}/ask", response_model=dict)
async def ask_ai(
    email_id: str,
    body: AskAIBody,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Ask the AI a freeform question about this email."""
    import anthropic as _anthropic
    from config import settings as _settings
    user_id = _current_user_id(current_user)
    supabase = get_supabase()

    email_row = supabase.table("emails").select(
        "subject, sender, body, ai_summary"
    ).eq("id", email_id).eq("user_id", user_id).single().execute()
    if not email_row.data:
        raise HTTPException(status_code=404, detail="Email not found.")
    e = email_row.data

    prompt = (
        f"Email context:\nSubject: {e.get('subject','')}\n"
        f"From: {e.get('sender','')}\n"
        f"AI Summary: {e.get('ai_summary','(not processed yet)')}\n"
        f"Body: {(e.get('body',''))[:2000]}\n\n"
        f"User question: {body.question}\n\n"
        f"Answer concisely and helpfully."
    )
    try:
        client = _anthropic.AsyncAnthropic(api_key=_settings.ANTHROPIC_API_KEY)
        resp = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        answer = resp.content[0].text if resp.content else "No answer generated."
        return {"answer": answer}
    except Exception as exc:
        logger.error("ask_ai error: %s", exc)
        raise HTTPException(status_code=500, detail="AI request failed.")


@router.get("/{email_id}/thread-summary", response_model=dict)
async def get_thread_summary(
    email_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Generate an AI summary of the entire email thread."""
    try:
        import json
        supabase = get_supabase()
        user_id = _current_user_id(current_user)

        # Get the email and its thread ID
        email_row = supabase.table("emails").select(
            "id, subject, sender, gmail_thread_id"
        ).eq("id", email_id).eq("user_id", user_id).single().execute()

        if not email_row.data:
            raise HTTPException(status_code=404, detail="Email not found.")

        thread_id = email_row.data.get("gmail_thread_id") or email_id

        # Fetch all emails in the thread
        thread_rows = supabase.table("emails").select(
            "id, subject, sender, body, received_at"
        ).eq("user_id", user_id).eq("gmail_thread_id", thread_id).order(
            "received_at", desc=False
        ).limit(20).execute()

        emails_in_thread = thread_rows.data or [email_row.data]

        if len(emails_in_thread) <= 1:
            return {
                "thread_length": 1,
                "summary": None,
                "key_points": [],
                "status": "single_email",
            }

        # Build thread text for AI
        thread_text = ""
        for idx, e in enumerate(emails_in_thread, 1):
            received = e.get("received_at", "")[:10] if e.get("received_at") else ""
            thread_text += f"\n--- Email {idx} ({received}) from {e.get('sender', 'Unknown')} ---\n"
            thread_text += f"Subject: {e.get('subject', '')}\n"
            thread_text += (e.get("body") or "")[:600]
            thread_text += "\n"

        from ai.classifier import client as ai_client

        prompt = f"""You are summarizing an email thread for a busy professional.

Thread ({len(emails_in_thread)} emails):
{thread_text[:4000]}

Return ONLY a JSON object with:
- summary: string (2-3 sentence overview of the full conversation)
- key_points: array of strings (3-5 key points or decisions from the thread)
- next_action: string or null (what action is needed, if any)
- sentiment: one of "positive", "neutral", "negative", "mixed"
"""

        response = await ai_client.messages.create(
            model="claude-opus-4-6",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )

        text = next((b.text for b in response.content if b.type == "text"), None)
        raw = (text or "{}").strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        result = json.loads(raw.strip())
        result["thread_length"] = len(emails_in_thread)
        result["status"] = "summarized"
        return result

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("thread_summary error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to generate thread summary.")


# ---------------------------------------------------------------------------
# Health Score (must be before /{email_id} to avoid path conflict)
# ---------------------------------------------------------------------------

@router.get("/health-score", response_model=dict)
async def get_inbox_health_score(
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Compute an inbox health score (0-100) from inbox metrics."""
    from datetime import timezone, timedelta
    user_id = _current_user_id(current_user)
    supabase = get_supabase()

    try:
        now = datetime.now(timezone.utc)
        week_ago = (now - timedelta(days=7)).isoformat()

        recent = supabase.table("emails").select(
            "id, is_read, processed, priority, category"
        ).eq("user_id", user_id).gte("received_at", week_ago).execute()
        emails = recent.data or []

        total = len(emails)
        if total == 0:
            return {"score": 100, "grade": "A", "breakdown": {}, "tips": ["Inbox is empty — great start!"]}

        unread = sum(1 for e in emails if not e.get("is_read"))
        processed = sum(1 for e in emails if e.get("processed"))
        urgent_unread = sum(1 for e in emails if not e.get("is_read") and (e.get("priority") or 0) >= 8)
        spam_count = sum(1 for e in emails if e.get("category") in ("spam", "newsletter"))

        overdue_result = supabase.table("actions").select("id").eq(
            "status", "pending"
        ).lt("deadline", now.isoformat()).execute()
        overdue_count = len(overdue_result.data or [])

        read_score = max(0, 100 - int((unread / total) * 100))
        processed_score = int((processed / total) * 100) if total > 0 else 100
        urgent_penalty = min(50, urgent_unread * 10)
        action_penalty = min(30, overdue_count * 10)
        noise_ratio = spam_count / total if total > 0 else 0
        noise_score = max(0, 100 - int(noise_ratio * 60))

        score = max(0, min(100, int(
            read_score * 0.30 + processed_score * 0.25 + noise_score * 0.20 +
            (100 - urgent_penalty) * 0.15 + (100 - action_penalty) * 0.10
        )))
        grade = "A" if score >= 90 else "B" if score >= 75 else "C" if score >= 60 else "D" if score >= 45 else "F"

        tips = []
        if unread > 5:
            tips.append(f"You have {unread} unread emails this week — try reading or archiving them.")
        if processed < total * 0.5:
            tips.append("Less than half your emails are AI-processed. Run processing to get summaries.")
        if urgent_unread > 0:
            tips.append(f"{urgent_unread} urgent email(s) are unread — address these first.")
        if overdue_count > 0:
            tips.append(f"{overdue_count} overdue action item(s) need attention.")
        if noise_ratio > 0.4:
            tips.append("Many newsletters/spam in inbox — consider unsubscribing or setting rules.")
        if not tips:
            tips.append("Inbox is well-managed. Keep it up!")

        return {
            "score": score,
            "grade": grade,
            "breakdown": {
                "read_score": read_score,
                "processed_score": processed_score,
                "noise_score": noise_score,
                "urgent_unread": urgent_unread,
                "overdue_actions": overdue_count,
                "total_emails_week": total,
                "unread_count": unread,
            },
            "tips": tips,
        }
    except Exception as exc:
        logger.error("health_score error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to compute health score.")


@router.get("/{email_id}")
async def get_email(
    email_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Retrieve a single email by ID."""
    email = await email_service.get_email(
        email_id=email_id, user_id=_current_user_id(current_user)
    )
    if not email:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Email {email_id} not found.",
        )
    return email


@router.post("/{email_id}/process", status_code=status.HTTP_202_ACCEPTED)
async def trigger_ai_processing(
    email_id: str,
    background_tasks: BackgroundTasks,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Manually trigger AI processing for a specific email."""
    user_id = _current_user_id(current_user)

    plan = await _get_user_plan(user_id)
    limit = PLAN_LIMITS.get(plan)
    if limit is not None:
        used = await _get_emails_used_this_month(user_id)
        if used >= limit:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Monthly limit of {limit} emails reached. Upgrade to Pro for unlimited processing.",
            )

    email = await email_service.get_email(email_id=email_id, user_id=user_id)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Email {email_id} not found.",
        )

    background_tasks.add_task(process_email, email)
    return {"message": "AI processing queued.", "email_id": email_id}


@router.delete("/{email_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_email(
    email_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Delete an email."""
    success = await email_service.delete_email(
        email_id=email_id, user_id=_current_user_id(current_user)
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Email {email_id} not found or already deleted.",
        )
    return None


# ---------------------------------------------------------------------------
# Reply draft sub-routes (frontend calls /api/emails/{id}/reply-draft)
# ---------------------------------------------------------------------------

class ReplyDraftUpdate(BaseModel):
    draft_content: str


class SendReplyBody(BaseModel):
    content: str


class GenerateReplyBody(BaseModel):
    instructions: str


@router.get("/{email_id}/reply-draft")
async def get_email_reply_draft(
    email_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Get the AI reply draft for an email."""
    user_id = _current_user_id(current_user)
    email = await email_service.get_email(email_id=email_id, user_id=user_id)
    if not email:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found.")

    supabase = get_supabase()
    result = (
        supabase.table("reply_drafts")
        .select("*")
        .eq("email_id", email_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No reply draft found for this email.",
        )
    draft = result.data
    voice_match = await get_voice_match_summary(user_id)
    return {
        **draft,
        "draft_content": draft.get("draft_text", ""),
        "confidence_score": draft.get("confidence", 0.0),
        "tone": "professional",
        "is_sent": draft.get("sent", False),
        "voice_match_score": voice_match["score"],
        "voice_match_trend": voice_match["trend"],
    }


@router.patch("/{email_id}/reply-draft")
async def update_email_reply_draft(
    email_id: str,
    body: ReplyDraftUpdate,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Update the reply draft content for an email."""
    user_id = _current_user_id(current_user)
    email = await email_service.get_email(email_id=email_id, user_id=user_id)
    if not email:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found.")

    supabase = get_supabase()
    result = (
        supabase.table("reply_drafts")
        .update({"draft_text": body.draft_content})
        .eq("email_id", email_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reply draft not found.")
    draft = result.data[0]
    return {**draft, "draft_content": draft.get("draft_text", ""), "is_sent": draft.get("sent", False)}


@router.post("/{email_id}/send-reply")
async def send_email_reply(
    email_id: str,
    body: SendReplyBody,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Send a reply to an email via Gmail."""
    user_id = _current_user_id(current_user)
    email = await email_service.get_email(email_id=email_id, user_id=user_id)
    if not email:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found.")

    success = await send_gmail_reply(
        user_id=user_id,
        thread_id=email.get("thread_id") or email.get("gmail_thread_id") or "",
        to=email.get("sender") or email.get("from_email", ""),
        subject=email.get("subject", ""),
        body=body.content,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to send reply via Gmail.",
        )

    # Mark draft as sent
    supabase = get_supabase()
    try:
        supabase.table("reply_drafts").update({"sent": True}).eq("email_id", email_id).execute()
    except Exception as exc:
        logger.warning("Could not mark reply_draft as sent for email %s: %s", email_id, exc)

    return {"success": True, "message": "Reply sent successfully."}


@router.get("/{email_id}/attachments")
async def list_email_attachments(
    email_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """List attachments for an email."""
    user_id = _current_user_id(current_user)
    email = await email_service.get_email(email_id=email_id, user_id=user_id)
    if not email:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found.")
    gmail_message_id = email.get("gmail_message_id")
    if not gmail_message_id:
        return []
    return await get_email_attachments(user_id=user_id, gmail_message_id=gmail_message_id)


@router.get("/{email_id}/attachments/{attachment_id}/download")
async def download_attachment(
    email_id: str,
    attachment_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
    filename: str = Query("attachment"),
    mime_type: str = Query("application/octet-stream"),
):
    """Download a Gmail attachment proxied through the backend."""
    user_id = _current_user_id(current_user)
    email = await email_service.get_email(email_id=email_id, user_id=user_id)
    if not email:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found.")
    gmail_message_id = email.get("gmail_message_id")
    if not gmail_message_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No Gmail message ID.")
    data = await get_attachment_data(
        user_id=user_id, gmail_message_id=gmail_message_id, attachment_id=attachment_id
    )
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found.")
    return Response(
        content=data,
        media_type=mime_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{email_id}/unsubscribe")
async def unsubscribe_email(
    email_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Follow the List-Unsubscribe URL encoded in email labels."""
    import httpx
    user_id = _current_user_id(current_user)
    email = await email_service.get_email(email_id=email_id, user_id=user_id)
    if not email:
        raise HTTPException(status_code=404, detail="Email not found.")
    unsub_url = next(
        (l.split(":", 1)[1] for l in (email.get("labels") or []) if l.startswith("__unsub__:")),
        None,
    )
    if not unsub_url:
        raise HTTPException(status_code=400, detail="No unsubscribe link found for this email.")
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(unsub_url, headers={"User-Agent": "Mailair/1.0"})
        return {"success": resp.status_code < 400, "status_code": resp.status_code, "url": unsub_url}
    except Exception as exc:
        logger.warning("Unsubscribe request failed for email %s: %s", email_id, exc)
        return {"success": False, "error": str(exc), "url": unsub_url}


@router.post("/{email_id}/attachments/{attachment_id}/summarize")
async def summarize_attachment(
    email_id: str,
    attachment_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
    filename: str = Query("attachment"),
    mime_type: str = Query("application/octet-stream"),
):
    """Use AI to summarize a text-based attachment (PDF, DOCX, TXT, CSV)."""
    import base64
    user_id = _current_user_id(current_user)
    email = await email_service.get_email(email_id=email_id, user_id=user_id)
    if not email:
        raise HTTPException(status_code=404, detail="Email not found.")
    gmail_message_id = email.get("gmail_message_id")
    if not gmail_message_id:
        raise HTTPException(status_code=400, detail="No Gmail message ID.")

    data = await get_attachment_data(
        user_id=user_id, gmail_message_id=gmail_message_id, attachment_id=attachment_id
    )
    if data is None:
        raise HTTPException(status_code=404, detail="Attachment not found.")

    # Attempt to decode text content
    text_content = None
    if mime_type in ("text/plain", "text/csv", "application/csv"):
        try:
            text_content = data.decode("utf-8", errors="replace")[:6000]
        except Exception:
            pass
    elif mime_type in ("application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"):
        # Send as base64 to Claude vision for PDF/DOCX
        text_content = f"[Binary file: {filename}. Base64 excerpt follows]\n" + base64.b64encode(data[:4000]).decode()

    if not text_content:
        return {"summary": f"Cannot summarize {mime_type} files automatically.", "filename": filename}

    try:
        import anthropic as _anthropic
        from config import settings as _settings
        _client = _anthropic.AsyncAnthropic(api_key=_settings.ANTHROPIC_API_KEY)
        resp = await _client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            messages=[{"role": "user", "content": (
                f"Summarize this attachment in 3-5 bullet points. Be concise.\n\n"
                f"Filename: {filename}\n\n{text_content}"
            )}],
        )
        summary = resp.content[0].text.strip()
    except Exception as exc:
        logger.error("Attachment summarize failed: %s", exc)
        summary = "Summary unavailable."

    return {"summary": summary, "filename": filename, "mime_type": mime_type}


@router.post("/{email_id}/generate-reply")
async def generate_reply_with_instructions(
    email_id: str,
    body: GenerateReplyBody,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Generate a new AI reply draft based on user instructions."""
    from ai.reply_generator import generate_reply
    from ai.embeddings import find_similar_replies

    user_id = _current_user_id(current_user)
    email = await email_service.get_email(email_id=email_id, user_id=user_id)
    if not email:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found.")

    # Fetch user profile for tone/company context
    supabase = get_supabase()
    company_description = "a professional service business"
    tone = "professional and friendly"
    try:
        profile = supabase.table("user_profiles").select(
            "company_description, tone_preference, industry"
        ).eq("id", user_id).single().execute()
        if profile.data:
            company_description = (
                profile.data.get("company_description")
                or (f"a {profile.data['industry']} business" if profile.data.get("industry") else None)
                or company_description
            )
            tone = profile.data.get("tone_preference") or tone
    except Exception:
        pass

    draft_text, confidence = await generate_reply(
        subject=email.get("subject", ""),
        sender=email.get("sender") or email.get("from_email", ""),
        body=email.get("body") or email.get("body_text", ""),
        company_description=company_description,
        tone=tone,
        user_instructions=body.instructions,
    )

    # Upsert the new draft
    supabase.table("reply_drafts").upsert(
        {
            "email_id": email_id,
            "user_id": user_id,
            "draft_text": draft_text,
            "confidence": confidence,
        },
        on_conflict="email_id",
    ).execute()

    return {
        "draft_content": draft_text,
        "confidence_score": confidence,
        "tone": tone,
        "is_sent": False,
    }



# ---------------------------------------------------------------------------
# AI Natural Language Search
# ---------------------------------------------------------------------------

class AISearchBody(BaseModel):
    query: str
    page: int = 1
    page_size: int = 20


@router.post("/ai-search", response_model=dict)
async def ai_natural_language_search(
    body: AISearchBody,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Parse a natural language search query with AI, then search emails."""
    import json as _json
    import anthropic as _anthropic
    from config import settings as _settings

    user_id = _current_user_id(current_user)

    parse_prompt = f"""Convert this natural language email search query into structured filters.

Query: "{body.query}"

Return ONLY a JSON object with these optional fields (omit fields not relevant):
- category: one of ["urgent_client_request","quote_request","support_issue","internal_communication","follow_up_required","informational","spam","newsletter"]
- is_read: boolean
- search: string (keyword to search in subject/sender/body)
- priority_min: integer 1-10 (minimum priority score)
- sender_contains: string (part of sender email or name)
- days_back: integer (how many days back to look, e.g. 7 for "last week")
- sort_by: "received_at" or "priority_score"
- sort_order: "asc" or "desc"

Examples:
- "unread urgent emails from last week" → {{"is_read": false, "priority_min": 8, "days_back": 7}}
- "newsletters I haven't read" → {{"category": "newsletter", "is_read": false}}
- "emails from john about invoices" → {{"search": "invoice", "sender_contains": "john"}}"""

    try:
        _client = _anthropic.AsyncAnthropic(api_key=_settings.ANTHROPIC_API_KEY)
        resp = await _client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            messages=[{"role": "user", "content": parse_prompt}],
        )
        raw = resp.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed = _json.loads(raw.strip())
    except Exception as exc:
        logger.warning("AI search parse failed, falling back to keyword: %s", exc)
        parsed = {"search": body.query}

    # Build filters from parsed result
    from datetime import timezone, timedelta
    supabase = get_supabase()
    offset = (body.page - 1) * body.page_size

    q = supabase.table("emails").select(
        "id, subject, sender, from_email, from_name, received_at, is_read, category, priority, ai_summary, snippet, processed"
    ).eq("user_id", user_id)

    if parsed.get("category"):
        q = q.eq("category", parsed["category"])
    if parsed.get("is_read") is not None:
        q = q.eq("is_read", parsed["is_read"])
    if parsed.get("priority_min"):
        q = q.gte("priority", parsed["priority_min"])
    if parsed.get("days_back"):
        cutoff = (datetime.now(timezone.utc) - timedelta(days=parsed["days_back"])).isoformat()
        q = q.gte("received_at", cutoff)
    if parsed.get("sender_contains"):
        q = q.ilike("sender", f"%{parsed['sender_contains']}%")
    if parsed.get("search"):
        term = parsed["search"]
        q = q.or_(f"subject.ilike.%{term}%,sender.ilike.%{term}%,body.ilike.%{term}%")

    sort_col = parsed.get("sort_by", "received_at")
    sort_desc = parsed.get("sort_order", "desc") == "desc"
    q = q.order(sort_col, desc=sort_desc).range(offset, offset + body.page_size - 1)

    result = q.execute()
    items = result.data or []

    return {
        "items": items,
        "total": len(items),
        "page": body.page,
        "page_size": body.page_size,
        "parsed_query": parsed,
        "original_query": body.query,
    }


# ---------------------------------------------------------------------------
# Compose (send new email)
# ---------------------------------------------------------------------------

class ComposeEmailBody(BaseModel):
    to: str
    subject: str
    body: str


@router.post("/compose", response_model=dict)
async def compose_email(
    body: ComposeEmailBody,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Send a new email via Gmail (not a reply)."""
    from services.gmail_service import send_gmail_compose
    user_id = _current_user_id(current_user)
    success = await send_gmail_compose(
        user_id=user_id,
        to=body.to,
        subject=body.subject,
        body=body.body,
    )
    if not success:
        raise HTTPException(status_code=502, detail="Failed to send email via Gmail.")
    return {"success": True}


# ---------------------------------------------------------------------------
# AI Draft for Compose
# ---------------------------------------------------------------------------

class AIDraftBody(BaseModel):
    to: str
    subject: str
    context: str = ""


@router.post("/ai-draft", response_model=dict)
async def generate_compose_draft(
    body: AIDraftBody,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Generate an AI-written email draft for the compose screen."""
    import anthropic as _anthropic
    from config import settings as _settings

    user_id = _current_user_id(current_user)
    supabase = get_supabase()

    company_description = "a professional service business"
    tone = "professional and friendly"
    email_signature = ""
    try:
        profile = supabase.table("user_profiles").select(
            "company_description, tone_preference, email_signature, industry"
        ).eq("id", user_id).single().execute()
        if profile.data:
            company_description = (
                profile.data.get("company_description")
                or (f"a {profile.data['industry']} business" if profile.data.get("industry") else None)
                or company_description
            )
            tone = profile.data.get("tone_preference") or tone
            email_signature = profile.data.get("email_signature") or ""
    except Exception:
        pass

    prompt = f"""You are writing a professional email on behalf of {company_description}.

To: {body.to}
Subject: {body.subject}
{f"Additional context / instructions: {body.context}" if body.context else ""}
Tone: {tone}

Write a complete, ready-to-send email body. Do NOT include a subject line, greeting like "Dear", or any meta-commentary. Just the email body starting with the opening sentence."""

    try:
        _client = _anthropic.AsyncAnthropic(api_key=_settings.ANTHROPIC_API_KEY)
        resp = await _client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        draft = resp.content[0].text.strip()
        if email_signature:
            draft = draft.rstrip() + "\n\n" + email_signature.strip()
        return {"draft": draft}
    except Exception as exc:
        logger.error("ai_draft error: %s", exc)
        raise HTTPException(status_code=500, detail="AI draft generation failed.")
