"""
Daily social post worker — picks today's content from the rotation and
publishes it via Zernio. Guarded by SOCIAL_AUTOPOST_ENABLED so it never
posts to a real Instagram/LinkedIn account until explicitly turned on.

Can be triggered two ways: the in-process APScheduler cron (only fires
if the backend happens to be awake at 15:00 UTC — Render's free tier
sleeps when idle) and an external GitHub Actions workflow hitting
POST /api/cron/daily-social-post, which wakes the service via the
request itself. job_run_service's same-day claim means only the first
of the two to fire actually posts.
"""
import logging

from config import settings
from services.social_content import get_todays_post
from services.zernio_service import post_content
from services.job_run_service import claim_run

logger = logging.getLogger(__name__)

JOB_NAME = "daily_social_post"


async def post_daily_social():
    """Publish today's rotation post — safe to call from multiple triggers."""
    if not settings.SOCIAL_AUTOPOST_ENABLED:
        logger.info("SOCIAL_AUTOPOST_ENABLED is false — skipping daily social post.")
        return

    if not claim_run(JOB_NAME):
        logger.info("Daily social post already ran today — skipping.")
        return

    post = get_todays_post()
    try:
        result = await post_content(post["caption"], post["slides"])
        logger.info("Daily social post published (theme=%s, slides=%d): %s", post["theme"], len(post["slides"]), result.get("image_urls"))
    except Exception as exc:
        logger.error("Daily social post failed (theme=%s): %s", post["theme"], exc)
