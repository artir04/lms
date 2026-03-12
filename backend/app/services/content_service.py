import uuid
import os
import aiofiles
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import UploadFile

from app.models.content import Module, Lesson, Attachment
from app.core.exceptions import NotFoundError
from app.core.pagination import PaginationParams
from app.schemas.content import ModuleCreate, ModuleUpdate, LessonCreate, LessonUpdate
from app.config import get_settings

settings = get_settings()


class ContentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_modules(self, course_id: uuid.UUID) -> list[Module]:
        result = await self.db.execute(
            select(Module).where(Module.course_id == course_id).order_by(Module.position)
        )
        return result.scalars().all()

    async def get_module(self, module_id: uuid.UUID) -> Module:
        result = await self.db.execute(select(Module).where(Module.id == module_id))
        module = result.scalar_one_or_none()
        if not module:
            raise NotFoundError("Module")
        return module

    async def create_module(self, course_id: uuid.UUID, data: ModuleCreate) -> Module:
        module = Module(course_id=course_id, **data.model_dump())
        self.db.add(module)
        await self.db.flush()
        return module

    async def update_module(self, module_id: uuid.UUID, data: ModuleUpdate) -> Module:
        module = await self.get_module(module_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(module, field, value)
        await self.db.flush()
        return module

    async def delete_module(self, module_id: uuid.UUID) -> None:
        module = await self.get_module(module_id)
        await self.db.delete(module)
        await self.db.flush()

    async def list_lessons(self, module_id: uuid.UUID) -> list[Lesson]:
        result = await self.db.execute(
            select(Lesson).where(Lesson.module_id == module_id).order_by(Lesson.position)
        )
        return result.scalars().all()

    async def get_lesson(self, lesson_id: uuid.UUID) -> Lesson:
        result = await self.db.execute(select(Lesson).where(Lesson.id == lesson_id))
        lesson = result.scalar_one_or_none()
        if not lesson:
            raise NotFoundError("Lesson")
        return lesson

    async def create_lesson(self, module_id: uuid.UUID, data: LessonCreate) -> Lesson:
        lesson = Lesson(module_id=module_id, **data.model_dump())
        self.db.add(lesson)
        await self.db.flush()
        return lesson

    async def update_lesson(self, lesson_id: uuid.UUID, data: LessonUpdate) -> Lesson:
        lesson = await self.get_lesson(lesson_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(lesson, field, value)
        await self.db.flush()
        return lesson

    async def delete_lesson(self, lesson_id: uuid.UUID) -> None:
        lesson = await self.get_lesson(lesson_id)
        await self.db.delete(lesson)
        await self.db.flush()

    async def upload_attachment(self, lesson_id: uuid.UUID, file: UploadFile) -> Attachment:
        # Save file locally (swap for S3 in production)
        storage_key = f"lessons/{lesson_id}/{uuid.uuid4()}_{file.filename}"
        dest = os.path.join(settings.MEDIA_ROOT, storage_key)
        os.makedirs(os.path.dirname(dest), exist_ok=True)

        content = await file.read()
        async with aiofiles.open(dest, "wb") as f:
            await f.write(content)

        attachment = Attachment(
            lesson_id=lesson_id,
            filename=file.filename,
            storage_key=storage_key,
            mime_type=file.content_type or "application/octet-stream",
            size_bytes=len(content),
        )
        self.db.add(attachment)
        await self.db.flush()
        return attachment

    def get_attachment_url(self, storage_key: str) -> str:
        return f"/media/{storage_key}"
