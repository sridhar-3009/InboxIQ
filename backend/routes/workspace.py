"""
Small-team workspace — shared docs, file sharing, simple chat, and
workspace settings. Built on top of the existing organizations /
org_members tables (invites + roles already live in routes/teams.py).

Deliberately NOT: real-time collaborative multi-cursor doc editing,
video/audio calls, or device-level policy enforcement — none of those
translate to "just build it for the web," see the product discussion
this was scoped from.
"""
import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from pydantic import BaseModel, Field

import re

from database import get_supabase
from middleware.auth import get_current_user
from services.notification_service import create_notification

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/workspace", tags=["workspace"])

FILES_BUCKET = "team-files"
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB


def _uid(u: dict) -> str:
    return u["id"]


def _get_user_org(user_id: str) -> dict:
    supabase = get_supabase()
    row = supabase.table("user_profiles").select("org_id, org_role, name, email").eq("id", user_id).single().execute()
    return row.data or {}


def _require_org(user_data: dict) -> str:
    org_id = user_data.get("org_id")
    if not org_id:
        raise HTTPException(status_code=404, detail="You are not part of any organization yet.")
    return org_id


def _require_admin(user_data: dict):
    if user_data.get("org_role", "member") not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required.")


# ─── Docs ───────────────────────────────────────────────────────────────────

class DocCreate(BaseModel):
    title: str = "Untitled"
    content: str = ""
    folder: str | None = None


class DocUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    folder: str | None = None


@router.get("/docs")
async def list_docs(current_user: Annotated[dict, Depends(get_current_user)]):
    user_data = _get_user_org(_uid(current_user))
    org_id = _require_org(user_data)
    supabase = get_supabase()
    result = (
        supabase.table("team_docs")
        .select("id, title, folder, updated_at, updated_by")
        .eq("org_id", org_id)
        .order("updated_at", desc=True)
        .execute()
    )
    return {"docs": result.data or []}


@router.post("/docs", status_code=status.HTTP_201_CREATED)
async def create_doc(body: DocCreate, current_user: Annotated[dict, Depends(get_current_user)]):
    user_id = _uid(current_user)
    org_id = _require_org(_get_user_org(user_id))
    supabase = get_supabase()
    result = supabase.table("team_docs").insert({
        "org_id": org_id, "title": body.title, "content": body.content, "folder": body.folder,
        "created_by": user_id, "updated_by": user_id,
    }).execute()
    return result.data[0] if result.data else {}


@router.get("/docs/{doc_id}")
async def get_doc(doc_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    org_id = _require_org(_get_user_org(_uid(current_user)))
    supabase = get_supabase()
    result = supabase.table("team_docs").select("*").eq("id", doc_id).eq("org_id", org_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Doc not found.")
    return result.data


@router.put("/docs/{doc_id}")
async def update_doc(doc_id: str, body: DocUpdate, current_user: Annotated[dict, Depends(get_current_user)]):
    user_id = _uid(current_user)
    org_id = _require_org(_get_user_org(user_id))
    supabase = get_supabase()
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    update["updated_by"] = user_id
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = supabase.table("team_docs").update(update).eq("id", doc_id).eq("org_id", org_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Doc not found.")
    return result.data[0]


@router.delete("/docs/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_doc(doc_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    org_id = _require_org(_get_user_org(_uid(current_user)))
    get_supabase().table("team_docs").delete().eq("id", doc_id).eq("org_id", org_id).execute()


# ─── Files ──────────────────────────────────────────────────────────────────

@router.get("/files")
async def list_files(current_user: Annotated[dict, Depends(get_current_user)]):
    org_id = _require_org(_get_user_org(_uid(current_user)))
    supabase = get_supabase()
    result = (
        supabase.table("team_files")
        .select("*")
        .eq("org_id", org_id)
        .order("created_at", desc=True)
        .execute()
    )
    return {"files": result.data or []}


@router.post("/files", status_code=status.HTTP_201_CREATED)
async def upload_file(current_user: Annotated[dict, Depends(get_current_user)], file: UploadFile = File(...)):
    user_id = _uid(current_user)
    org_id = _require_org(_get_user_org(user_id))

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large (25MB limit).")

    supabase = get_supabase()
    storage_path = f"{org_id}/{datetime.now(timezone.utc).timestamp()}-{file.filename}"
    supabase.storage.from_(FILES_BUCKET).upload(
        storage_path, contents, file_options={"content-type": file.content_type or "application/octet-stream"}
    )
    result = supabase.table("team_files").insert({
        "org_id": org_id,
        "filename": file.filename,
        "storage_path": storage_path,
        "content_type": file.content_type,
        "size_bytes": len(contents),
        "uploaded_by": user_id,
    }).execute()
    return result.data[0] if result.data else {}


@router.get("/files/{file_id}/download")
async def download_file(file_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    org_id = _require_org(_get_user_org(_uid(current_user)))
    supabase = get_supabase()
    row = supabase.table("team_files").select("*").eq("id", file_id).eq("org_id", org_id).single().execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="File not found.")
    signed = supabase.storage.from_(FILES_BUCKET).create_signed_url(row.data["storage_path"], 300)
    return {"url": signed.get("signedURL") or signed.get("signedUrl"), "filename": row.data["filename"]}


@router.delete("/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(file_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    org_id = _require_org(_get_user_org(_uid(current_user)))
    supabase = get_supabase()
    row = supabase.table("team_files").select("storage_path").eq("id", file_id).eq("org_id", org_id).single().execute()
    if row.data:
        try:
            supabase.storage.from_(FILES_BUCKET).remove([row.data["storage_path"]])
        except Exception as exc:
            logger.warning("Storage remove failed for %s: %s", file_id, exc)
        supabase.table("team_files").delete().eq("id", file_id).eq("org_id", org_id).execute()


# ─── Chat ───────────────────────────────────────────────────────────────────

class ChannelCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)


@router.get("/channels")
async def list_channels(current_user: Annotated[dict, Depends(get_current_user)]):
    org_id = _require_org(_get_user_org(_uid(current_user)))
    supabase = get_supabase()
    result = supabase.table("team_channels").select("*").eq("org_id", org_id).order("created_at").execute()
    return {"channels": result.data or []}


@router.post("/channels", status_code=status.HTTP_201_CREATED)
async def create_channel(body: ChannelCreate, current_user: Annotated[dict, Depends(get_current_user)]):
    user_id = _uid(current_user)
    org_id = _require_org(_get_user_org(user_id))
    supabase = get_supabase()
    try:
        result = supabase.table("team_channels").insert({
            "org_id": org_id, "name": body.name.strip().lower().replace(" ", "-"), "created_by": user_id,
        }).execute()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A channel with that name already exists.")
    return result.data[0] if result.data else {}


@router.get("/channels/{channel_id}/messages")
async def list_messages(channel_id: str, current_user: Annotated[dict, Depends(get_current_user)], limit: int = 50):
    org_id = _require_org(_get_user_org(_uid(current_user)))
    supabase = get_supabase()
    result = (
        supabase.table("team_messages")
        .select("*")
        .eq("channel_id", channel_id)
        .eq("org_id", org_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return {"messages": list(reversed(result.data or []))}


def _notify_mentions(content: str, org_id: str, author_name: str, channel_id: str):
    """Parse @name tokens and notify any matching org member (best-effort)."""
    handles = set(re.findall(r"@([a-zA-Z0-9_.\-]+)", content))
    if not handles:
        return
    try:
        supabase = get_supabase()
        members = (
            supabase.table("org_members")
            .select("user_id, user_profiles(id, name, email)")
            .eq("org_id", org_id)
            .eq("status", "active")
            .execute()
        )
        for m in members.data or []:
            profile = m.get("user_profiles") or {}
            name = (profile.get("name") or "").strip()
            email_handle = (profile.get("email") or "").split("@")[0]
            name_handle = name.lower().replace(" ", "")
            if not m.get("user_id"):
                continue
            if any(h.lower() in (name_handle, email_handle.lower()) for h in handles):
                create_notification(
                    user_id=m["user_id"],
                    org_id=org_id,
                    notif_type="mention",
                    title=f"{author_name} mentioned you",
                    body=content[:200],
                    link="/workspace",
                )
    except Exception:
        logger.warning("Mention notification lookup failed for org %s", org_id, exc_info=True)


@router.post("/channels/{channel_id}/messages", status_code=status.HTTP_201_CREATED)
async def send_message(channel_id: str, body: MessageCreate, current_user: Annotated[dict, Depends(get_current_user)]):
    user_id = _uid(current_user)
    user_data = _get_user_org(user_id)
    org_id = _require_org(user_data)
    author_name = user_data.get("name") or user_data.get("email", "Someone")
    supabase = get_supabase()
    result = supabase.table("team_messages").insert({
        "channel_id": channel_id, "org_id": org_id, "user_id": user_id,
        "author_name": author_name,
        "content": body.content,
    }).execute()
    _notify_mentions(body.content, org_id, author_name, channel_id)
    return result.data[0] if result.data else {}


# ─── Workspace settings ─────────────────────────────────────────────────────

class SettingsUpdate(BaseModel):
    allowed_email_domains: list[str] | None = None


@router.get("/settings")
async def get_settings(current_user: Annotated[dict, Depends(get_current_user)]):
    org_id = _require_org(_get_user_org(_uid(current_user)))
    supabase = get_supabase()
    result = supabase.table("organizations").select(
        "id, name, allowed_email_domains"
    ).eq("id", org_id).single().execute()
    return result.data or {}


@router.put("/settings")
async def update_settings(body: SettingsUpdate, current_user: Annotated[dict, Depends(get_current_user)]):
    user_data = _get_user_org(_uid(current_user))
    org_id = _require_org(user_data)
    _require_admin(user_data)
    supabase = get_supabase()
    update = body.model_dump(exclude_none=True)
    if not update:
        raise HTTPException(status_code=400, detail="No fields provided.")
    result = supabase.table("organizations").update(update).eq("id", org_id).execute()
    return result.data[0] if result.data else {}
