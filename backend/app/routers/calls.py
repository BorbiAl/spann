"""WebSocket signaling relay for peer-to-peer calls."""

from __future__ import annotations

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter(tags=["calls"])

# room_id → list of active WebSocket connections
_rooms: dict[str, list[WebSocket]] = {}


@router.websocket("/ws/{room}")
async def ws_relay(websocket: WebSocket, room: str) -> None:
    """Relay every message to all other peers in the same room."""

    await websocket.accept()
    _rooms.setdefault(room, []).append(websocket)
    logger.info("ws_peer_joined", extra={"room": room, "peers": len(_rooms[room])})

    try:
        while True:
            data = await websocket.receive_text()
            for peer in list(_rooms.get(room, [])):
                if peer is not websocket:
                    try:
                        await peer.send_text(data)
                    except Exception:  # noqa: BLE001
                        pass
    except WebSocketDisconnect:
        pass
    finally:
        room_peers = _rooms.get(room, [])
        if websocket in room_peers:
            room_peers.remove(websocket)
        if not room_peers:
            _rooms.pop(room, None)
        logger.info("ws_peer_left", extra={"room": room, "peers": len(_rooms.get(room, []))})
