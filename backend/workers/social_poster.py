"""
Daily social post worker — picks today's content from the rotation and
publishes it via Zernio. Guarded by SOCIAL_AUTOPOST_ENABLED so it never
posts to a real Instagram/LinkedIn account until explicitly turned on.
"""
import logging

from config import settings
from services.social_content import get_todays_post
from services.zernio_service import post_content

logger = logging.getLogger(__name__)


async def post_daily_social():
    """APScheduler job: publish today's rotation post."""
    if not settings.SOCIAL_AUTOPOST_ENABLED:
        logger.info("SOCIAL_AUTOPOST_ENABLED is false — skipping daily social post.")
        return

    post = get_todays_post()
    try:
        result = await post_content(post["caption"], post["slides"])
        logger.info("Daily social post published (theme=%s, slides=%d): %s", post["theme"], len(post["slides"]), result.get("image_urls"))
    except Exception as exc:
        logger.error("Daily social post failed (theme=%s): %s", post["theme"], exc)
