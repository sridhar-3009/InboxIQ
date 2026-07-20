import json
import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response

from database import get_supabase
from middleware.auth import get_current_user
from models.user import UserProfile, UserUpdate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/settings", tags=["settings"])


def _user_id(current_user: dict) -> str:
    return current_user["id"]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("", response_model=dict)
async def get_settings(current_user: Annotated[dict, Depends(get_current_user)]):
    """
    Return all user settings including integration status and preferences.
    """
    try:
        supabase = get_supabase()
        result = (
            supabase.table("user_profiles")
            .select("*")
            .eq("id", _user_id(current_user))
            .single()
            .execute()
        )
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found.",
            )
        return result.data
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("get_settings error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve settings.",
        )


@router.put("", response_model=dict)
async def update_settings(
    body: UserUpdate,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Update user preferences and settings."""
    try:
        supabase = get_supabase()
        update_data = body.model_dump(exclude_none=True)

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields provided for update.",
            )

        result = (
            supabase.table("user_profiles")
            .update(update_data)
            .eq("id", _user_id(current_user))
            .execute()
        )
        return result.data[0] if result.data else {}

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("update_settings error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update settings.",
        )


@router.get("/export-data")
async def export_user_data(current_user: Annotated[dict, Depends(get_current_user)]):
    """GDPR: Export all user data as a JSON file."""
    try:
        supabase = get_supabase()
        uid = _user_id(current_user)

        profile = supabase.table("user_profiles").select("*").eq("id", uid).single().execute()
        emails = supabase.table("emails").select(
            "id, subject, sender, body, category, priority, ai_summary, received_at, is_read, created_at"
        ).eq("user_id", uid).order("received_at", desc=True).limit(1000).execute()
        actions = supabase.table("actions").select("*").eq("user_id", uid).limit(500).execute()
        replies = supabase.table("reply_drafts").select(
            "id, email_id, draft_text, is_sent, created_at"
        ).eq("user_id", uid).limit(500).execute()

        export = {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "user_id": uid,
            "profile": profile.data or {},
            "emails": emails.data or [],
            "actions": actions.data or [],
            "reply_drafts": replies.data or [],
        }

        filename = f"mailair-data-{datetime.now(timezone.utc).strftime('%Y%m%d')}.json"
        return Response(
            content=json.dumps(export, indent=2, default=str),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as exc:
        logger.error("export_user_data error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to export data.")


@router.delete("/delete-account", status_code=status.HTTP_200_OK)
async def delete_account(current_user: Annotated[dict, Depends(get_current_user)]):
    """GDPR: Delete all user data. Irreversible."""
    try:
        supabase = get_supabase()
        uid = _user_id(current_user)
        # Delete in dependency order
        supabase.table("reply_drafts").delete().eq("user_id", uid).execute()
        supabase.table("actions").delete().eq("user_id", uid).execute()
        supabase.table("emails").delete().eq("user_id", uid).execute()
        supabase.table("user_profiles").delete().eq("id", uid).execute()
        return {"message": "Account and all data deleted successfully."}
    except Exception as exc:
        logger.error("delete_account error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to delete account.")


@router.get("/profile", response_model=dict)
async def get_profile(current_user: Annotated[dict, Depends(get_current_user)]):
    """
    Return a subset of the user profile (name, email, plan, connected
    integrations).
    """
    try:
        supabase = get_supabase()
        result = (
            supabase.table("user_profiles")
            .select(
                "id, name, plan, gmail_connected, tone_preference,"
                " company_description, created_at"
            )
            .eq("id", _user_id(current_user))
            .single()
            .execute()
        )
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profile not found.",
            )
        return {**result.data, "email": current_user.get("email", "")}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("get_profile error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve profile.",
        )


@router.put("/profile", response_model=dict)
async def update_profile(
    body: UserUpdate,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Update the user's public profile fields."""
    try:
        supabase = get_supabase()
        update_data = body.model_dump(exclude_none=True)

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields provided for update.",
            )

        result = (
            supabase.table("user_profiles")
            .update(update_data)
            .eq("id", _user_id(current_user))
            .execute()
        )
        return result.data[0] if result.data else {}

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("update_profile error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile.",
        )
