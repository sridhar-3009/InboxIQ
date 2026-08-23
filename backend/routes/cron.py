"""
External cron triggers — for jobs that need to fire even when the
backend is asleep (Render's free tier spins down when idle, which
kills the in-process APScheduler). A GitHub Actions workflow hits
these on a schedule; the HTTP request itself wakes the service.

Auth is a shared secret (X-Cron-Secret header), not a user session —
there's no logged-in user driving this. Never expose these under
/api/admin/*, which requires a real Supabase session.
"""
import logging
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, status

from config import settings
from workers.social_poster import post_daily_social

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cron", tags=["cron"])


def _verify_secret(x_cron_secret: str | None):
    if not settings.CRON_SECRET:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="CRON_SECRET is not configured.")
    if not x_cron_secret or x_cron_secret != settings.CRON_SECRET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid cron secret.")


@router.post("/daily-social-post")
async def trigger_daily_social_post(x_cron_secret: Annotated[str | None, Header()] = None):
    _verify_secret(x_cron_secret)
    await post_daily_social()
    return {"status": "ok"}
