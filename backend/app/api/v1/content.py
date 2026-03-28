import uuid
from fastapi import APIRouter, Depends, UploadFile, File
from app.db.session import get_db
from app.dependencies import CurrentUserPayload, require_roles
from app.services.content_service import ContentService
from app.services.analytics_service import AnalyticsService
from app.core.permissions import Role
from app.schemas.content import ModuleCreate, ModuleUpdate, ModuleRead, LessonCreate, LessonUpdate, LessonRead, AttachmentRead
from app.schemas.common import MessageResponse

router = APIRouter(prefix="/courses/{course_id}", tags=["content"])


@router.get("/modules", response_model=list[ModuleRead])
async def list_modules(course_id: uuid.UUID, db=Depends(get_db)):
    service = ContentService(db)
    modules = await service.list_modules(course_id)
    return [{**m.__dict__, "lesson_count": len(m.lessons) if m.lessons else 0} for m in modules]


@router.post("/modules", response_model=ModuleRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def create_module(course_id: uuid.UUID, data: ModuleCreate, db=Depends(get_db)):
    return await ContentService(db).create_module(course_id, data)


@router.patch("/modules/{module_id}", response_model=ModuleRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def update_module(course_id: uuid.UUID, module_id: uuid.UUID, data: ModuleUpdate, db=Depends(get_db)):
    return await ContentService(db).update_module(module_id, data)


@router.delete("/modules/{module_id}", response_model=MessageResponse, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def delete_module(course_id: uuid.UUID, module_id: uuid.UUID, db=Depends(get_db)):
    await ContentService(db).delete_module(module_id)
    return MessageResponse(message="Module deleted")


@router.get("/modules/{module_id}/lessons", response_model=list[LessonRead])
async def list_lessons(course_id: uuid.UUID, module_id: uuid.UUID, db=Depends(get_db)):
    return await ContentService(db).list_lessons(module_id)


@router.post("/modules/{module_id}/lessons", response_model=LessonRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def create_lesson(course_id: uuid.UUID, module_id: uuid.UUID, data: LessonCreate, db=Depends(get_db)):
    return await ContentService(db).create_lesson(module_id, data)


@router.get("/lessons/{lesson_id}", response_model=LessonRead)
async def get_lesson(
    course_id: uuid.UUID,
    lesson_id: uuid.UUID,
    payload: CurrentUserPayload,
    db=Depends(get_db),
):
    svc = ContentService(db)
    lesson = await svc.get_lesson(lesson_id)
    await AnalyticsService(db).log_event(
        tenant_id=uuid.UUID(payload["tenant_id"]),
        user_id=uuid.UUID(payload["sub"]),
        event_type="lesson_view",
        resource_id=lesson_id,
    )
    return lesson


@router.patch("/lessons/{lesson_id}", response_model=LessonRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def update_lesson(course_id: uuid.UUID, lesson_id: uuid.UUID, data: LessonUpdate, db=Depends(get_db)):
    return await ContentService(db).update_lesson(lesson_id, data)


@router.post("/lessons/{lesson_id}/attachments", response_model=AttachmentRead, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def upload_attachment(course_id: uuid.UUID, lesson_id: uuid.UUID, file: UploadFile = File(...), db=Depends(get_db)):
    svc = ContentService(db)
    attachment = await svc.upload_attachment(lesson_id, file)
    return {**attachment.__dict__, "url": svc.get_attachment_url(attachment.storage_key)}


@router.put("/modules/reorder", response_model=MessageResponse, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def reorder_modules(course_id: uuid.UUID, positions: list[dict], db=Depends(get_db)):
    """Reorder modules. positions = [{"id": "...", "position": 0}, ...]"""
    service = ContentService(db)
    for item in positions:
        mod = await service.get_module(uuid.UUID(item["id"]))
        mod.position = item["position"]
    await db.flush()
    await db.commit()
    return MessageResponse(message="Modules reordered")


@router.put("/modules/{module_id}/lessons/reorder", response_model=MessageResponse, dependencies=[require_roles(Role.TEACHER, Role.ADMIN)])
async def reorder_lessons(course_id: uuid.UUID, module_id: uuid.UUID, positions: list[dict], db=Depends(get_db)):
    """Reorder lessons within a module. positions = [{"id": "...", "position": 0}, ...]"""
    service = ContentService(db)
    for item in positions:
        lesson = await service.get_lesson(uuid.UUID(item["id"]))
        lesson.position = item["position"]
    await db.flush()
    await db.commit()
    return MessageResponse(message="Lessons reordered")
