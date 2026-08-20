"""
Zernio API client — publishes to Instagram and LinkedIn (company page).

Reference (docs.zernio.com):
  POST https://zernio.com/api/v1/posts
  Auth: Authorization: Bearer $ZERNIO_API_KEY
  Instagram requires media (no text-only posts); LinkedIn media is optional.
"""
import logging
import uuid
from datetime import datetime, timezone

import httpx

from config import settings
from database import get_supabase
from services.social_image import generate_slide_image

logger = logging.getLogger(__name__)

ZERNIO_API_BASE = "https://zernio.com/api/v1"
STORAGE_BUCKET = "social-posts"


def upload_post_image(image_bytes: bytes) -> str:
    """Upload a generated image to Supabase Storage and return its public URL."""
    supabase = get_supabase()
    filename = f"{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:8]}.png"
    supabase.storage.from_(STORAGE_BUCKET).upload(
        filename,
        image_bytes,
        file_options={"content-type": "image/png"},
    )
    public_url = supabase.storage.from_(STORAGE_BUCKET).get_public_url(filename)
    return public_url


def _build_platforms() -> list[dict]:
    platforms = []
    if settings.ZERNIO_INSTAGRAM_ACCOUNT_ID:
        platforms.append({"platform": "instagram", "accountId": settings.ZERNIO_INSTAGRAM_ACCOUNT_ID})
    if settings.ZERNIO_LINKEDIN_ACCOUNT_ID:
        linkedin: dict = {"platform": "linkedin", "accountId": settings.ZERNIO_LINKEDIN_ACCOUNT_ID}
        if settings.ZERNIO_LINKEDIN_ORG_URN:
            linkedin["platformSpecificData"] = {"organizationUrn": settings.ZERNIO_LINKEDIN_ORG_URN}
        platforms.append(linkedin)
    return platforms


async def publish_post(caption: str, image_urls: list[str], publish_now: bool = True) -> dict:
    """Publish a post (single image, or a carousel of up to 10) to every configured platform."""
    if not settings.ZERNIO_API_KEY:
        raise RuntimeError("ZERNIO_API_KEY is not configured.")

    platforms = _build_platforms()
    if not platforms:
        raise RuntimeError("No Zernio platform account IDs configured (ZERNIO_INSTAGRAM_ACCOUNT_ID / ZERNIO_LINKEDIN_ACCOUNT_ID).")

    body = {
        "content": caption,
        "mediaItems": [{"type": "image", "url": url} for url in image_urls[:10]],
        "platforms": platforms,
        "publishNow": publish_now,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{ZERNIO_API_BASE}/posts",
            json=body,
            headers={"Authorization": f"Bearer {settings.ZERNIO_API_KEY}"},
        )
        resp.raise_for_status()
        return resp.json()


async def post_content(caption: str, slides: list[dict]) -> dict:
    """Full pipeline: render every slide, upload each, publish as one post
    (a single image, or a carousel if there's more than one slide)."""
    image_urls = []
    for slide in slides:
        image_bytes = generate_slide_image(slide)
        image_urls.append(upload_post_image(image_bytes))

    result = await publish_post(caption, image_urls)
    logger.info("Zernio post published (%d slide(s)): %s", len(image_urls), result.get("id") or result)
    return {"image_urls": image_urls, "zernio_response": result}
