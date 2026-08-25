"""
WebRTC signaling for in-app voice/video calls.

We do not run a media server (SFU/MCU) — calls are peer-to-peer mesh,
suited for small groups (2-4 people), which matches the small-team
scope of the rest of the workspace. This module only relays signaling
messages (offer/answer/ICE candidates) between browser peers; the
actual audio/video streams flow directly between clients via WebRTC,
never through this server.
"""
import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from jose.exceptions import JWTError

from database import get_supabase
from middleware.auth import _decode_supabase_jwt, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(tags=["calls"])


def _get_user_org(user_id: str) -> dict:
    supabase = get_supabase()
    row = supabase.table("user_profiles").select("org_id, name").eq("id", user_id).single().execute()
    return row.data or {}


def _channel_org_id(channel_id: str) -> str | None:
    supabase = get_supabase()
    row = supabase.table("team_channels").select("org_id").eq("id", channel_id).single().execute()
    return (row.data or {}).get("org_id")


@router.get("/workspace/channels/{channel_id}/call-info")
async def call_info(channel_id: str, current_user: Annotated[dict, Depends(get_current_user)]):
    """Lets the client confirm it's allowed into the room before opening the websocket."""
    user_data = _get_user_org(current_user["id"])
    org_id = user_data.get("org_id")
    if not org_id or _channel_org_id(channel_id) != org_id:
        raise HTTPException(status_code=404, detail="Channel not found.")
    room = _rooms.get(channel_id)
    return {
        "room_id": channel_id,
        "participant_count": len(room) if room else 0,
        "ice_servers": [{"urls": ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]}],
    }


# ─── Signaling relay ────────────────────────────────────────────────────────

class Peer:
    __slots__ = ("ws", "peer_id", "name")

    def __init__(self, ws: WebSocket, peer_id: str, name: str):
        self.ws = ws
        self.peer_id = peer_id
        self.name = name


# room_id -> {peer_id: Peer}
_rooms: dict[str, dict[str, Peer]] = {}


async def _broadcast(room_id: str, message: dict, exclude: str | None = None):
    room = _rooms.get(room_id, {})
    for peer_id, peer in list(room.items()):
        if peer_id == exclude:
            continue
        try:
            await peer.ws.send_json(message)
        except Exception:
            logger.warning("Failed to send to peer %s in room %s", peer_id, room_id)


@router.websocket("/ws/calls/{room_id}")
async def call_signaling(websocket: WebSocket, room_id: str, token: str = Query(...)):
    try:
        payload = _decode_supabase_jwt(token)
    except (JWTError, Exception):
        await websocket.close(code=4401)
        return

    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=4401)
        return

    user_data = _get_user_org(user_id)
    org_id = user_data.get("org_id")
    if not org_id or _channel_org_id(room_id) != org_id:
        await websocket.close(code=4403)
        return

    name = user_data.get("name") or payload.get("email") or "Someone"
    peer_id = user_id
    await websocket.accept()

    room = _rooms.setdefault(room_id, {})
    existing_peers = [{"peer_id": p.peer_id, "name": p.name} for p in room.values()]
    room[peer_id] = Peer(websocket, peer_id, name)

    await websocket.send_json({"type": "room-joined", "peers": existing_peers})
    await _broadcast(room_id, {"type": "peer-joined", "peer_id": peer_id, "name": name}, exclude=peer_id)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type")
            target = msg.get("target")

            if msg_type in ("offer", "answer", "ice-candidate") and target:
                target_peer = room.get(target)
                if target_peer:
                    await target_peer.ws.send_json({**msg, "from": peer_id, "name": name})
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("Call signaling error in room %s for peer %s", room_id, peer_id)
    finally:
        room.pop(peer_id, None)
        if not room:
            _rooms.pop(room_id, None)
        await _broadcast(room_id, {"type": "peer-left", "peer_id": peer_id})
