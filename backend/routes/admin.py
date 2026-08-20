"""
Platform-level admin routes.
All endpoints require the authenticated user to be the platform admin
(email must match ADMIN_EMAIL in config).
"""
import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from config import settings
from database import get_supabase
from middleware.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])

PLAN_ORDER = {"free": 0, "pro": 1, "agency": 2}
PLAN_MONTHLY_PRICE = {"free": 0, "pro": 199, "agency": 1499}


# ---------------------------------------------------------------------------
# Admin guard
# ---------------------------------------------------------------------------

async def require_admin(current_user: Annotated[dict, Depends(get_current_user)]) -> dict:
    """Dependency — raises 403 if caller is not the platform admin."""
    email = current_user.get("email", "")
    if email != settings.ADMIN_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class PlanUpdateBody(BaseModel):
    plan: str  # "free" | "pro" | "agency"


# ---------------------------------------------------------------------------
# Social posting (Zernio)
# ---------------------------------------------------------------------------

@router.get("/social/preview")
async def preview_social_post(_: Annotated[dict, Depends(require_admin)]):
    """Preview today's rotation content and rendered slide(s) — does not post."""
    from services.social_content import get_todays_post
    from services.social_image import generate_slide_image
    import base64

    post = get_todays_post()
    slide_images = [
        f"data:image/png;base64,{base64.b64encode(generate_slide_image(slide)).decode()}"
        for slide in post["slides"]
    ]
    return {
        **post,
        "slide_images": slide_images,
        "autopost_enabled": settings.SOCIAL_AUTOPOST_ENABLED,
        "platforms_configured": bool(settings.ZERNIO_INSTAGRAM_ACCOUNT_ID or settings.ZERNIO_LINKEDIN_ACCOUNT_ID),
    }


@router.post("/social/post-now")
async def trigger_social_post(_: Annotated[dict, Depends(require_admin)]):
    """Publish today's rotation content immediately, bypassing the daily
    schedule and the SOCIAL_AUTOPOST_ENABLED gate — for testing."""
    from services.social_content import get_todays_post
    from services.zernio_service import post_content

    post = get_todays_post()
    try:
        result = await post_content(post["caption"], post["slides"])
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Zernio post failed: {exc}")
    return {**post, **result}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/stats")
async def get_platform_stats(_: Annotated[dict, Depends(require_admin)]):
    """High-level platform metrics."""
    supabase = get_supabase()

    # All user profiles
    profiles_res = supabase.table("user_profiles").select("id, plan, subscription_status, created_at").execute()
    profiles = profiles_res.data or []

    total_users = len(profiles)
    paying = [p for p in profiles if p.get("plan") in ("pro", "agency")]
    pro_count = sum(1 for p in paying if p.get("plan") == "pro")
    agency_count = sum(1 for p in paying if p.get("plan") == "agency")
    mrr = pro_count * PLAN_MONTHLY_PRICE["pro"] + agency_count * PLAN_MONTHLY_PRICE["agency"]

    # Emails this month
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    emails_res = (
        supabase.table("emails")
        .select("id", count="exact")
        .gte("created_at", month_start)
        .execute()
    )
    emails_this_month = emails_res.count or 0

    # Processed emails total
    processed_res = (
        supabase.table("emails")
        .select("id", count="exact")
        .eq("processed", True)
        .execute()
    )
    total_processed = processed_res.count or 0

    # New users this month
    new_users_res = (
        supabase.table("user_profiles")
        .select("id", count="exact")
        .gte("created_at", month_start)
        .execute()
    )
    new_users_this_month = new_users_res.count or 0

    return {
        "total_users": total_users,
        "paying_users": len(paying),
        "pro_users": pro_count,
        "agency_users": agency_count,
        "free_users": total_users - len(paying),
        "mrr_inr": mrr,
        "emails_this_month": emails_this_month,
        "total_processed_emails": total_processed,
        "new_users_this_month": new_users_this_month,
    }


@router.get("/users")
async def get_all_users(_: Annotated[dict, Depends(require_admin)]):
    """All users with plan, usage and subscription info."""
    supabase = get_supabase()

    profiles_res = (
        supabase.table("user_profiles")
        .select("id, email, plan, subscription_status, subscription_id, created_at")
        .order("created_at", desc=True)
        .execute()
    )
    profiles = profiles_res.data or []

    # Get email counts per user (processed only)
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    enriched = []
    for p in profiles:
        uid = p.get("id")
        # Count AI-processed emails this month
        usage_res = (
            supabase.table("emails")
            .select("id", count="exact")
            .eq("user_id", uid)
            .eq("processed", True)
            .gte("created_at", month_start)
            .execute()
        )
        emails_used = usage_res.count or 0

        # Count total emails
        total_res = (
            supabase.table("emails")
            .select("id", count="exact")
            .eq("user_id", uid)
            .execute()
        )
        total_emails = total_res.count or 0

        enriched.append({
            **p,
            "emails_used_this_month": emails_used,
            "total_emails": total_emails,
        })

    return {"users": enriched, "total": len(enriched)}


@router.patch("/users/{user_id}/plan")
async def update_user_plan(
    user_id: str,
    body: PlanUpdateBody,
    _: Annotated[dict, Depends(require_admin)],
):
    """Manually override a user's subscription plan."""
    if body.plan not in PLAN_ORDER:
        raise HTTPException(status_code=400, detail=f"Invalid plan '{body.plan}'. Must be free, pro, or agency.")

    supabase = get_supabase()
    result = (
        supabase.table("user_profiles")
        .update({"plan": body.plan})
        .eq("id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found.")

    logger.info("Admin changed plan for user_id=%s to %s", user_id, body.plan)
    return {"user_id": user_id, "plan": body.plan, "message": "Plan updated successfully."}


@router.get("/webhooks")
async def get_webhook_logs(_: Annotated[dict, Depends(require_admin)]):
    """Recent Razorpay webhook events (last 50)."""
    supabase = get_supabase()
    try:
        res = (
            supabase.table("webhook_logs")
            .select("*")
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        return {"logs": res.data or []}
    except Exception:
        # Table may not exist yet — return empty
        return {"logs": []}
