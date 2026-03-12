import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.models.messaging import Thread, Message, MessageRecipient
from app.core.exceptions import NotFoundError, ForbiddenError
from app.schemas.messaging import ThreadCreate, MessageCreate


class MessagingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_threads(self, user_id: uuid.UUID, tenant_id: uuid.UUID) -> list[dict]:
        result = await self.db.execute(
            select(Thread)
            .join(MessageRecipient, MessageRecipient.thread_id == Thread.id)
            .where(Thread.tenant_id == tenant_id, MessageRecipient.user_id == user_id)
            .options(selectinload(Thread.messages), selectinload(Thread.recipients))
            .order_by(Thread.created_at.desc())
        )
        threads = result.scalars().all()

        output = []
        for thread in threads:
            unread = await self.db.execute(
                select(func.count()).select_from(MessageRecipient).where(
                    MessageRecipient.thread_id == thread.id,
                    MessageRecipient.user_id == user_id,
                    MessageRecipient.read_at == None,
                )
            )
            last_msg = max(thread.messages, key=lambda m: m.sent_at, default=None) if thread.messages else None
            output.append({
                **thread.__dict__,
                "unread_count": unread.scalar_one(),
                "last_message": last_msg,
            })
        return output

    async def get_thread(self, thread_id: uuid.UUID, user_id: uuid.UUID) -> Thread:
        result = await self.db.execute(
            select(Thread)
            .options(selectinload(Thread.messages), selectinload(Thread.recipients))
            .where(Thread.id == thread_id)
        )
        thread = result.scalar_one_or_none()
        if not thread:
            raise NotFoundError("Thread")

        # Check access
        participant_ids = [r.user_id for r in thread.recipients]
        if user_id not in participant_ids:
            raise ForbiddenError("Not a participant in this thread")
        return thread

    async def create_thread(self, data: ThreadCreate, creator_id: uuid.UUID, tenant_id: uuid.UUID) -> Thread:
        thread = Thread(
            tenant_id=tenant_id,
            subject=data.subject,
            course_id=data.course_id,
            created_by=creator_id,
        )
        self.db.add(thread)
        await self.db.flush()

        # Add participants
        all_participants = list(set([creator_id] + data.recipient_ids))
        for uid in all_participants:
            self.db.add(MessageRecipient(thread_id=thread.id, user_id=uid))

        # Initial message
        msg = Message(
            thread_id=thread.id,
            sender_id=creator_id,
            body=data.initial_message,
            sent_at=datetime.now(timezone.utc),
        )
        self.db.add(msg)
        await self.db.flush()
        return thread

    async def send_message(self, thread_id: uuid.UUID, sender_id: uuid.UUID, data: MessageCreate) -> Message:
        await self.get_thread(thread_id, sender_id)
        msg = Message(
            thread_id=thread_id,
            sender_id=sender_id,
            body=data.body,
            sent_at=datetime.now(timezone.utc),
        )
        self.db.add(msg)

        # Reset read_at for other participants
        result = await self.db.execute(
            select(MessageRecipient).where(
                MessageRecipient.thread_id == thread_id,
                MessageRecipient.user_id != sender_id,
            )
        )
        for rec in result.scalars().all():
            rec.read_at = None

        await self.db.flush()
        return msg

    async def mark_read(self, thread_id: uuid.UUID, user_id: uuid.UUID) -> None:
        result = await self.db.execute(
            select(MessageRecipient).where(
                MessageRecipient.thread_id == thread_id,
                MessageRecipient.user_id == user_id,
            )
        )
        rec = result.scalar_one_or_none()
        if rec:
            rec.read_at = datetime.now(timezone.utc)
            await self.db.flush()
