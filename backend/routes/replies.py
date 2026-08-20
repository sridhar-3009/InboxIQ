import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from database import get_supabase
from middleware.auth import get_current_user
from models.user import ReplyDraftResponse, ReplyDraftUpdate
from services.gmail_service import send_gmail_reply
from services.voice_match_service import get_voice_match_summary

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/replies", tags=["replies"])


def _user_id(current_user: dict) -> str:
    return current_user["id"]


def _assert_email_owned(supabase, email_id: str, user_id: str) -> dict:
    """Raises 404 if the email does not belong to the user."""
    result = (
        supabase.table("emails")
        .select("id, sender, subject, thread_id")
        .eq("id", email_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Email not found."
        )
    return result.data


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/voice-match", response_model=dict)
async def voice_match_trend(current_user: Annotated[dict, Depends(get_current_user)]):
    """How closely AI drafts match what the user actually sends, over time."""
    return await get_voice_match_summary(_user_id(current_user))


@router.get("/email/{email_id}", response_model=dict)
async def get_reply_draft(
    email_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Get the AI-generated reply draft for a specific email."""
    supabase = get_supabase()
    user_id = _user_id(current_user)

    _assert_email_owned(supabase, email_id, user_id)

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
    return result.data


@router.put("/{draft_id}", response_model=dict)
async def update_reply_draft(
    draft_id: str,
    body: ReplyDraftUpdate,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Update (edit) a reply draft before sending."""
    supabase = get_supabase()
    user_id = _user_id(current_user)

    # Verify ownership via user_id column on draft
    existing = (
        supabase.table("reply_drafts")
        .select("id, email_id, user_id")
        .eq("id", draft_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reply draft not found."
        )

    result = (
        supabase.table("reply_drafts")
        .update({"draft_text": body.draft_text})
        .eq("id", draft_id)
        .execute()
    )
    return result.data[0] if result.data else {}


@router.post("/{draft_id}/send", status_code=status.HTTP_200_OK)
async def send_reply(
    draft_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Send the reply draft via Gmail and mark it as sent."""
    supabase = get_supabase()
    user_id = _user_id(current_user)

    # Load draft
    draft_result = (
        supabase.table("reply_drafts")
        .select("*")
        .eq("id", draft_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not draft_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reply draft not found."
        )

    draft = draft_result.data
    email_id = draft["email_id"]

    # Load original email for thread / sender info
    email = _assert_email_owned(supabase, email_id, user_id)

    success = await send_gmail_reply(
        user_id=user_id,
        thread_id=email.get("thread_id") or "",
        to=email.get("sender", ""),
        subject=email.get("subject", ""),
        body=draft["draft_text"],
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to send reply via Gmail. Check Gmail connection.",
        )

    # Mark draft as sent
    try:
        supabase.table("reply_drafts").update({"sent": True}).eq(
            "id", draft_id
        ).execute()
    except Exception as exc:
        logger.warning("Could not mark draft %s as sent: %s", draft_id, exc)

    return {"message": "Reply sent successfully.", "draft_id": draft_id}
