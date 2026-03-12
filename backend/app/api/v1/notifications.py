import uuid
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from app.db.session import get_db
from app.dependencies import CurrentUserPayload
from app.services.notification_service import NotificationService
from app.core.pagination import PaginationParams
from app.schemas.notification import NotificationRead, MarkReadRequest
from app.schemas.common import PaginatedResponse, MessageResponse

router = APIRouter(prefix="/notifications", tags=["notifications"])


class ConnectionManager:
    def __init__(self):
        self.connections: dict[str, list[WebSocket]] = {}

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self.connections.setdefault(user_id, []).append(ws)

    def disconnect(self, user_id: str, ws: WebSocket):
        if user_id in self.connections:
            self.connections[user_id].remove(ws)

    async def send_to_user(self, user_id: str, data: dict):
        for ws in self.connections.get(user_id, []):
            try:
                await ws.send_json(data)
            except Exception:
                pass


manager = ConnectionManager()


@router.get("", response_model=PaginatedResponse[NotificationRead])
async def list_notifications(
    payload: CurrentUserPayload,
    db=Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    service = NotificationService(db)
    return await service.list_for_user(uuid.UUID(payload["sub"]), PaginationParams(page=page, page_size=page_size))


@router.post("/read", response_model=MessageResponse)
async def mark_read(data: MarkReadRequest, payload: CurrentUserPayload, db=Depends(get_db)):
    service = NotificationService(db)
    await service.mark_read(uuid.UUID(payload["sub"]), data.notification_ids)
    return MessageResponse(message="Notifications marked as read")


@router.websocket("/ws")
async def websocket_notifications(ws: WebSocket, token: str):
    from app.core.security import decode_token
    try:
        payload = decode_token(token)
        user_id = payload["sub"]
    except Exception:
        await ws.close(code=4001)
        return

    await manager.connect(user_id, ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, ws)
