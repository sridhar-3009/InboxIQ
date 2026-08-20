"""
Mini CRM — contact profiles auto-generated from email history.
"""
import logging
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query
from database import get_supabase
from middleware.auth import get_current_user
from services.touchpoint_service import get_touchpoints

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/contacts", tags=["contacts"])


def _uid(current_user: dict) -> str:
    return current_user["id"]


@router.get("", response_model=list[dict])
async def list_contacts(
    current_user: Annotated[dict, Depends(get_current_user)],
    search: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    """
    Return contact profiles built from email sender history.
    Each contact = unique sender_email with aggregated stats.
    """
    try:
        supabase = get_supabase()
        user_id = _uid(current_user)

        result = supabase.table("emails").select(
            "id, sender, subject, category, priority, received_at, ai_summary"
        ).eq("user_id", user_id).neq("dismissed", True).order(
            "received_at", desc=True
        ).execute()

        emails = result.data or []

        # Build contact map
        contacts: dict[str, dict] = {}
        for e in emails:
            sender = e.get("sender", "").strip()
            if not sender:
                continue

            # Parse "Name <email>" or just "email"
            if "<" in sender and ">" in sender:
                name_part, email_part = sender.rsplit("<", 1)
                name = name_part.strip().strip('"')
                email = email_part.rstrip(">").strip()
            else:
                email = sender
                name = sender.split("@")[0].replace(".", " ").title()

            if not email:
                continue

            if search:
                s = search.lower()
                if s not in email.lower() and s not in name.lower():
                    continue

            if email not in contacts:
                contacts[email] = {
                    "email": email,
                    "name": name or email,
                    "total_emails": 0,
                    "last_email_at": e.get("received_at"),
                    "categories": {},
                    "avg_priority": 0.0,
                    "priorities": [],
                    "recent_subjects": [],
                    "labels": [],
                }

            c = contacts[email]
            c["total_emails"] += 1

            cat = e.get("category") or "other"
            c["categories"][cat] = c["categories"].get(cat, 0) + 1

            pri = e.get("priority")
            if pri:
                c["priorities"].append(int(pri))

            if len(c["recent_subjects"]) < 3:
                c["recent_subjects"].append(e.get("subject", ""))

        # Compute averages, top category, sort by recency
        result_list = []
        for c in contacts.values():
            if c["priorities"]:
                c["avg_priority"] = round(sum(c["priorities"]) / len(c["priorities"]), 1)
            del c["priorities"]
            if c["categories"]:
                c["top_category"] = max(c["categories"], key=lambda k: c["categories"][k])
            else:
                c["top_category"] = "other"
            result_list.append(c)

        result_list.sort(key=lambda x: x.get("last_email_at") or "", reverse=True)
        return result_list[:limit]

    except Exception as exc:
        logger.error("list_contacts error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to load contacts.")


@router.get("/{email_address}", response_model=dict)
async def get_contact(
    email_address: str,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Return full email history for a specific contact."""
    try:
        supabase = get_supabase()
        user_id = _uid(current_user)

        result = supabase.table("emails").select(
            "id, sender, subject, category, priority, received_at, ai_summary, is_read, reply_drafts(is_sent)"
        ).eq("user_id", user_id).ilike("sender", f"%{email_address}%").neq(
            "dismissed", True
        ).order("received_at", desc=True).execute()

        emails = result.data or []
        if not emails:
            raise HTTPException(status_code=404, detail="Contact not found.")

        # Build profile
        sender = emails[0].get("sender", "")
        if "<" in sender and ">" in sender:
            name_part, email_part = sender.rsplit("<", 1)
            name = name_part.strip().strip('"')
            email = email_part.rstrip(">").strip()
        else:
            email = sender
            name = sender.split("@")[0].replace(".", " ").title()

        categories: dict[str, int] = {}
        replied_count = 0
        priorities = []
        for e in emails:
            cat = e.get("category") or "other"
            categories[cat] = categories.get(cat, 0) + 1
            if e.get("priority"):
                priorities.append(int(e["priority"]))
            drafts = e.get("reply_drafts") or []
            if any(d.get("is_sent") for d in (drafts if isinstance(drafts, list) else [drafts])):
                replied_count += 1

        return {
            "email": email,
            "name": name,
            "total_emails": len(emails),
            "replied_count": replied_count,
            "avg_priority": round(sum(priorities) / len(priorities), 1) if priorities else 0,
            "top_category": max(categories, key=lambda k: categories[k]) if categories else "other",
            "categories": categories,
            "last_email_at": emails[0].get("received_at") if emails else None,
            "first_email_at": emails[-1].get("received_at") if emails else None,
            "emails": [
                {
                    "id": e["id"],
                    "subject": e.get("subject", ""),
                    "category": e.get("category"),
                    "priority": e.get("priority"),
                    "received_at": e.get("received_at"),
                    "ai_summary": e.get("ai_summary"),
                    "is_read": e.get("is_read", False),
                }
                for e in emails[:20]
            ],
            "touchpoints": get_touchpoints(user_id, email, limit=20),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("get_contact error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to load contact.")
