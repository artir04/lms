import uuid
from fastapi import APIRouter, Depends
from app.db.session import get_db
from app.dependencies import CurrentUserPayload
from app.services.messaging_service import MessagingService
from app.schemas.messaging import ThreadCreate, MessageCreate
from app.schemas.common import MessageResponse

router = APIRouter(prefix="/messaging", tags=["messaging"])


@router.get("/threads", response_model=list[dict])
async def list_threads(payload: CurrentUserPayload, db=Depends(get_db)):
    service = MessagingService(db)
    return await service.list_threads(uuid.UUID(payload["sub"]), uuid.UUID(payload["tenant_id"]))


@router.post("/threads", response_model=dict)
async def create_thread(data: ThreadCreate, payload: CurrentUserPayload, db=Depends(get_db)):
    service = MessagingService(db)
    thread = await service.create_thread(data, uuid.UUID(payload["sub"]), uuid.UUID(payload["tenant_id"]))
    return {"id": thread.id, "subject": thread.subject}


@router.get("/threads/{thread_id}", response_model=dict)
async def get_thread(thread_id: uuid.UUID, payload: CurrentUserPayload, db=Depends(get_db)):
    service = MessagingService(db)
    thread = await service.get_thread(thread_id, uuid.UUID(payload["sub"]))
    return {
        "id": thread.id,
        "subject": thread.subject,
        "messages": [{"id": m.id, "sender_id": m.sender_id, "body": m.body, "sent_at": m.sent_at} for m in thread.messages],
    }


@router.post("/threads/{thread_id}/messages", response_model=dict)
async def send_message(thread_id: uuid.UUID, data: MessageCreate, payload: CurrentUserPayload, db=Depends(get_db)):
    service = MessagingService(db)
    msg = await service.send_message(thread_id, uuid.UUID(payload["sub"]), data)
    return {"id": msg.id, "sent_at": msg.sent_at}


@router.post("/threads/{thread_id}/read", response_model=MessageResponse)
async def mark_read(thread_id: uuid.UUID, payload: CurrentUserPayload, db=Depends(get_db)):
    service = MessagingService(db)
    await service.mark_read(thread_id, uuid.UUID(payload["sub"]))
    return MessageResponse(message="Marked as read")
