"""
Team collaboration routes — organizations, members, email assignments,
internal notes, and activity log.
"""
import logging
import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from database import get_supabase
from middleware.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/teams", tags=["teams"])


def _uid(u: dict) -> str:
    return u["id"]


# ─── Pydantic models ──────────────────────────────────────────────────────────

class CreateOrgBody(BaseModel):
    name: str

class InviteMemberBody(BaseModel):
    email: str
    role: str = "member"

class UpdateMemberRoleBody(BaseModel):
    role: str

class AssignEmailBody(BaseModel):
    assigned_to: str | None = None  # user_id or None to unassign

class InternalNoteBody(BaseModel):
    note: str = Field(..., min_length=1, max_length=5000)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _log_activity(org_id: str, user_id: str, actor_name: str, action: str,
                  resource_type: str = "", resource_id: str = "", metadata: dict | None = None):
    try:
        supabase = get_supabase()
        supabase.table("activity_log").insert({
            "org_id": org_id,
            "user_id": user_id,
            "actor_name": actor_name,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "metadata": metadata or {},
        }).execute()
    except Exception as exc:
        logger.warning("activity_log insert failed: %s", exc)


def _get_user_org(user_id: str) -> dict | None:
    supabase = get_supabase()
    row = supabase.table("user_profiles").select("org_id, org_role, name, email").eq("id", user_id).single().execute()
    return row.data or {}


def _require_org(user_data: dict) -> str:
    org_id = user_data.get("org_id")
    if not org_id:
        raise HTTPException(status_code=404, detail="You are not part of any organization. Create one first.")
    return org_id


def _require_admin(user_data: dict):
    role = user_data.get("org_role", "member")
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required.")


# ─── Org endpoints ────────────────────────────────────────────────────────────

@router.post("/org", status_code=status.HTTP_201_CREATED)
async def create_org(body: CreateOrgBody, current_user: Annotated[dict, Depends(get_current_user)]):
    """Create a new organization and set current user as owner."""
    uid = _uid(current_user)
    supabase = get_supabase()

    user_data = _get_user_org(uid)
    if user_data.get("org_id"):
        raise HTTPException(status_code=400, detail="You already belong to an organization.")

    slug = body.name.lower().replace(" ", "-")[:30] + "-" + secrets.token_hex(3)
    org = supabase.table("organizations").insert({
        "name": body.name,
        "owner_id": uid,
        "slug": slug,
    }).execute()
    org_id = org.data[0]["id"]

    supabase.table("user_profiles").update({
        "org_id": org_id,
        "org_role": "owner",
    }).eq("id", uid).execute()

    supabase.table("org_members").insert({
        "org_id": org_id,
        "user_id": uid,
        "role": "owner",
        "status": "active",
    }).execute()

    _log_activity(org_id, uid, user_data.get("name") or uid, "created_org", "organization", org_id)
    return org.data[0]


@router.get("/org")
async def get_org(current_user: Annotated[dict, Depends(get_current_user)]):
    """Get current user's organization details."""
    uid = _uid(current_user)
    try:
        user_data = _get_user_org(uid)
        org_id = _require_org(user_data)
        supabase = get_supabase()
        org = supabase.table("organizations").select("*").eq("id", org_id).single().execute()
        members = supabase.table("org_members").select(
            "id, role, status, invited_email, invite_token, created_at, user_profiles(id, name, email)"
        ).eq("org_id", org_id).execute()
        return {
            "org": org.data,
            "members": members.data or [],
            "your_role": user_data.get("org_role", "member"),
        }
    except HTTPException:
        raise
    except Exception:
        return {"org": None, "members": [], "your_role": "owner"}


@router.post("/org/invite")
async def invite_member(body: InviteMemberBody, current_user: Annotated[dict, Depends(get_current_user)]):
    """Invite a new member to the organization by email."""
    uid = _uid(current_user)
    user_data = _get_user_org(uid)
    org_id = _require_org(user_data)
    _require_admin(user_data)

    supabase = get_supabase()
    org = supabase.table("organizations").select("allowed_email_domains").eq("id", org_id).single().execute()
    allowed_domains = (org.data or {}).get("allowed_email_domains") or []
    if allowed_domains:
        domain = body.email.split("@")[-1].lower()
        if domain not in [d.lower().lstrip("@") for d in allowed_domains]:
            raise HTTPException(
                status_code=400,
                detail=f"This workspace only allows invites to: {', '.join(allowed_domains)}",
            )

    invite_token = secrets.token_urlsafe(32)
    supabase.table("org_members").insert({
        "org_id": org_id,
        "invited_email": body.email,
        "role": body.role,
        "status": "pending",
        "invite_token": invite_token,
    }).execute()

    _log_activity(org_id, uid, user_data.get("name") or uid, "invited_member",
                  "member", body.email, {"email": body.email, "role": body.role})
    return {"message": f"Invite sent to {body.email}", "invite_token": invite_token}


@router.post("/org/join/{invite_token}")
async def join_org(invite_token: str, current_user: Annotated[dict, Depends(get_current_user)]):
    """Accept an invite and join an organization."""
    uid = _uid(current_user)
    supabase = get_supabase()

    invite = supabase.table("org_members").select("*").eq("invite_token", invite_token).eq("status", "pending").execute()
    if not invite.data:
        raise HTTPException(status_code=404, detail="Invalid or expired invite token.")

    invite_row = invite.data[0]
    org_id = invite_row["org_id"]
    role = invite_row["role"]

    supabase.table("org_members").update({
        "user_id": uid,
        "status": "active",
        "invite_token": None,
    }).eq("id", invite_row["id"]).execute()

    supabase.table("user_profiles").update({
        "org_id": org_id,
        "org_role": role,
    }).eq("id", uid).execute()

    user_data = _get_user_org(uid)
    _log_activity(org_id, uid, user_data.get("name") or uid, "joined_org", "organization", org_id)
    return {"message": "You have joined the organization.", "org_id": org_id}


@router.delete("/org/members/{member_user_id}")
async def remove_member(member_user_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    """Remove a member from the organization."""
    uid = _uid(current_user)
    user_data = _get_user_org(uid)
    org_id = _require_org(user_data)
    _require_admin(user_data)

    supabase = get_supabase()
    supabase.table("org_members").update({"status": "removed"}).eq("org_id", org_id).eq("user_id", member_user_id).execute()
    supabase.table("user_profiles").update({"org_id": None, "org_role": "owner"}).eq("id", member_user_id).execute()

    _log_activity(org_id, uid, user_data.get("name") or uid, "removed_member", "member", member_user_id)
    return {"message": "Member removed."}


# ─── Email assignment endpoints ───────────────────────────────────────────────

@router.get("/workload")
async def get_workload(current_user: Annotated[dict, Depends(get_current_user)]):
    """How many emails are currently assigned to each active team member."""
    uid = _uid(current_user)
    user_data = _get_user_org(uid)
    org_id = _require_org(user_data)
    supabase = get_supabase()

    members = supabase.table("org_members").select(
        "user_id, user_profiles(id, name, email)"
    ).eq("org_id", org_id).eq("status", "active").execute()

    assignments = supabase.table("email_assignments").select("assigned_to").eq("org_id", org_id).execute()
    counts: dict[str, int] = {}
    for a in assignments.data or []:
        uid_assigned = a.get("assigned_to")
        if uid_assigned:
            counts[uid_assigned] = counts.get(uid_assigned, 0) + 1

    workload = []
    for m in members.data or []:
        profile = m.get("user_profiles") or {}
        member_uid = m.get("user_id")
        if not member_uid:
            continue
        workload.append({
            "user_id": member_uid,
            "name": profile.get("name") or profile.get("email") or "Unknown",
            "assigned_count": counts.get(member_uid, 0),
        })
    workload.sort(key=lambda x: x["assigned_count"], reverse=True)
    return {"workload": workload}


@router.get("/assignments/{email_id}")
async def get_assignment(email_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    """Get assignment for a specific email."""
    try:
        supabase = get_supabase()
        result = supabase.table("email_assignments").select(
            "*, user_profiles!assigned_to(id, name, email)"
        ).eq("email_id", email_id).execute()
        return result.data[0] if result.data else None
    except Exception:
        return None


@router.post("/assignments/{email_id}")
async def assign_email(email_id: str, body: AssignEmailBody, current_user: Annotated[dict, Depends(get_current_user)]):
    """Assign an email to a team member (or unassign)."""
    uid = _uid(current_user)
    user_data = _get_user_org(uid)
    org_id = _require_org(user_data)

    supabase = get_supabase()
    supabase.table("email_assignments").upsert({
        "email_id": email_id,
        "org_id": org_id,
        "assigned_to": body.assigned_to,
        "assigned_by": uid,
    }, on_conflict="email_id").execute()

    _log_activity(org_id, uid, user_data.get("name") or uid, "assigned_email",
                  "email", email_id, {"assigned_to": body.assigned_to})
    return {"message": "Assignment updated."}


# ─── Internal notes endpoints ─────────────────────────────────────────────────

def _verify_email_in_org(email_id: str, org_id: str) -> None:
    """Raise 404 if the email does not belong to any member of this org."""
    supabase = get_supabase()
    members = supabase.table("user_profiles").select("id").eq("org_id", org_id).execute()
    member_ids = [m["id"] for m in (members.data or [])]
    if not member_ids:
        raise HTTPException(status_code=404, detail="Email not found.")
    email_row = supabase.table("emails").select("id").eq("id", email_id).in_("user_id", member_ids).execute()
    if not email_row.data:
        raise HTTPException(status_code=404, detail="Email not found.")


@router.get("/notes/{email_id}")
async def get_notes(email_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    """Get all internal notes for an email."""
    try:
        uid = _uid(current_user)
        user_data = _get_user_org(uid)
        org_id = _require_org(user_data)
        _verify_email_in_org(email_id, org_id)
        supabase = get_supabase()
        notes = supabase.table("internal_notes").select(
            "*, user_profiles!user_id(id, name, email)"
        ).eq("email_id", email_id).order("created_at", desc=False).execute()
        return notes.data or []
    except HTTPException:
        raise
    except Exception:
        return []


@router.post("/notes/{email_id}", status_code=status.HTTP_201_CREATED)
async def add_note(email_id: str, body: InternalNoteBody, current_user: Annotated[dict, Depends(get_current_user)]):
    """Add an internal note to an email."""
    uid = _uid(current_user)
    user_data = _get_user_org(uid)
    org_id = _require_org(user_data)
    _verify_email_in_org(email_id, org_id)

    supabase = get_supabase()
    result = supabase.table("internal_notes").insert({
        "email_id": email_id,
        "org_id": org_id,
        "user_id": uid,
        "note": body.note,
    }).execute()

    _log_activity(org_id, uid, user_data.get("name") or uid, "added_note", "email", email_id)
    return result.data[0]


@router.delete("/notes/{note_id}")
async def delete_note(note_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    """Delete an internal note."""
    uid = _uid(current_user)
    supabase = get_supabase()
    supabase.table("internal_notes").delete().eq("id", note_id).eq("user_id", uid).execute()
    return {"message": "Note deleted."}


# ─── Activity log endpoints ───────────────────────────────────────────────────

@router.get("/activity")
async def get_activity(current_user: Annotated[dict, Depends(get_current_user)], limit: int = 50):
    """Get the organization's activity log."""
    uid = _uid(current_user)
    user_data = _get_user_org(uid)
    org_id = _require_org(user_data)

    supabase = get_supabase()
    log = supabase.table("activity_log").select("*").eq("org_id", org_id).order(
        "created_at", desc=True
    ).limit(limit).execute()
    return log.data or []


# ─── Admin stats endpoint ─────────────────────────────────────────────────────

@router.get("/admin/stats")
async def admin_stats(current_user: Annotated[dict, Depends(get_current_user)]):
    """Admin dashboard stats — member count, email counts, recent activity."""
    uid = _uid(current_user)
    user_data = _get_user_org(uid)
    org_id = _require_org(user_data)
    _require_admin(user_data)

    supabase = get_supabase()

    members = supabase.table("org_members").select("id", count="exact").eq("org_id", org_id).eq("status", "active").execute()
    pending = supabase.table("org_members").select("id", count="exact").eq("org_id", org_id).eq("status", "pending").execute()

    member_ids_result = supabase.table("org_members").select("user_id").eq("org_id", org_id).eq("status", "active").execute()
    member_ids = [r["user_id"] for r in (member_ids_result.data or []) if r.get("user_id")]

    total_emails = 0
    emails_today = 0
    if member_ids:
        from datetime import date
        today_start = date.today().isoformat()
        total_q = supabase.table("emails").select("id", count="exact").in_("user_id", member_ids).execute()
        today_q = supabase.table("emails").select("id", count="exact").in_("user_id", member_ids).gte("received_at", today_start).execute()
        total_emails = total_q.count or 0
        emails_today = today_q.count or 0

    recent_activity = supabase.table("activity_log").select("*").eq("org_id", org_id).order("created_at", desc=True).limit(20).execute()

    return {
        "member_count": members.count or 0,
        "pending_invites": pending.count or 0,
        "total_emails": total_emails,
        "emails_today": emails_today,
        "recent_activity": recent_activity.data or [],
    }
