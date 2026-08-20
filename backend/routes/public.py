"""Unauthenticated, publicly embeddable endpoints."""
from fastapi import APIRouter
from fastapi.responses import Response

from services.badge_service import generate_response_time_badge_svg

router = APIRouter()


@router.get("/api/public/badge/{user_id}/response-time.svg")
async def response_time_badge(user_id: str):
    svg = generate_response_time_badge_svg(user_id)
    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=3600"},
    )
