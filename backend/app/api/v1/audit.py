import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from app.core.pagination import PaginationParams, PaginatedResponse
from app.core.permissions import Role
from app.db.session import get_db
from app.dependencies import CurrentUserPayload, require_roles
from app.models.course import Course, Section
from app.models.tenant import District, School
from app.models.user import User
from app.services.audit_service import AuditService

router = APIRouter(prefix="/audit", tags=["audit"])


def _safe_uuid(value) -> uuid.UUID | None:
    if value is None:
        return None
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        return None


@router.get(
    "/logs",
    response_model=PaginatedResponse[dict],
    dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)],
)
async def list_audit_logs(
    payload: CurrentUserPayload,
    db=Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    action: str | None = None,
    actions: list[str] | None = Query(None, description="Filter by exact action (repeatable)"),
    action_prefixes: list[str] | None = Query(None, description="Filter by action prefix like 'user.' (repeatable)"),
    target_type: str | None = None,
    target_types: list[str] | None = Query(None, description="Filter by target type (repeatable)"),
    target_id: uuid.UUID | None = None,
    actor_user_id: uuid.UUID | None = None,
    search: str | None = None,
    date_from: datetime | None = Query(None, description="ISO start timestamp (inclusive)"),
    date_to: datetime | None = Query(None, description="ISO end timestamp (inclusive)"),
):
    service = AuditService(db)
    tenant_id = uuid.UUID(payload["tenant_id"])
    params = PaginationParams(page=page, page_size=page_size)
    paginated = await service.list_logs(
        tenant_id,
        params,
        action=action,
        actions=actions,
        action_prefixes=action_prefixes,
        target_type=target_type,
        target_types=target_types,
        target_id=target_id,
        actor_user_id=actor_user_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
    )

    rows = paginated.items

    # Collect IDs by entity type from target + metadata
    user_ids: set[uuid.UUID] = set()
    course_ids: set[uuid.UUID] = set()
    section_ids: set[uuid.UUID] = set()
    school_ids: set[uuid.UUID] = set()
    district_ids: set[uuid.UUID] = set()

    for r in rows:
        if r.target_type == "user" and r.target_id:
            user_ids.add(r.target_id)
        elif r.target_type == "course" and r.target_id:
            course_ids.add(r.target_id)
        elif r.target_type == "section" and r.target_id:
            section_ids.add(r.target_id)
        elif r.target_type == "school" and r.target_id:
            school_ids.add(r.target_id)
        elif r.target_type == "tenant" and r.target_id:
            district_ids.add(r.target_id)

        md = r.event_metadata or {}
        for key in ("student_id", "parent_id", "user_id", "from_teacher_id", "to_teacher_id", "teacher_id"):
            uid = _safe_uuid(md.get(key))
            if uid:
                user_ids.add(uid)
        for key in ("course_id", "from_course_id", "to_course_id"):
            cid = _safe_uuid(md.get(key))
            if cid:
                course_ids.add(cid)
        for key in ("section_id", "from_section_id", "to_section_id"):
            sid = _safe_uuid(md.get(key))
            if sid:
                section_ids.add(sid)
        for key in ("school_id",):
            sch = _safe_uuid(md.get(key))
            if sch:
                school_ids.add(sch)
        for raw in md.get("student_ids") or []:
            arr_id = _safe_uuid(raw)
            if arr_id:
                user_ids.add(arr_id)

    users_lookup: dict[str, dict] = {}
    if user_ids:
        u_rows = (
            await db.execute(
                select(User.id, User.first_name, User.last_name, User.email)
                .where(User.id.in_(user_ids), User.tenant_id == tenant_id)
            )
        ).all()
        users_lookup = {
            str(uid): {
                "id": str(uid),
                "full_name": f"{fn} {ln}".strip() or email,
                "email": email,
            }
            for uid, fn, ln, email in u_rows
        }

    courses_lookup: dict[str, dict] = {}
    if course_ids:
        c_rows = (
            await db.execute(
                select(Course.id, Course.title)
                .where(Course.id.in_(course_ids), Course.tenant_id == tenant_id)
            )
        ).all()
        courses_lookup = {str(cid): {"id": str(cid), "title": title} for cid, title in c_rows}

    sections_lookup: dict[str, dict] = {}
    if section_ids:
        s_rows = (
            await db.execute(
                select(Section.id, Section.name, Section.course_id, Course.title)
                .join(Course, Course.id == Section.course_id)
                .where(Section.id.in_(section_ids), Course.tenant_id == tenant_id)
            )
        ).all()
        sections_lookup = {
            str(sid): {
                "id": str(sid),
                "name": name,
                "course_id": str(cid),
                "course_title": ctitle,
            }
            for sid, name, cid, ctitle in s_rows
        }

    schools_lookup: dict[str, dict] = {}
    if school_ids:
        sch_rows = (
            await db.execute(
                select(School.id, School.name, School.code)
                .where(School.id.in_(school_ids), School.district_id == tenant_id)
            )
        ).all()
        schools_lookup = {
            str(sch_id): {"id": str(sch_id), "name": name, "code": code}
            for sch_id, name, code in sch_rows
        }

    districts_lookup: dict[str, dict] = {}
    if district_ids:
        d_rows = (
            await db.execute(
                select(District.id, District.name).where(District.id.in_(district_ids))
            )
        ).all()
        districts_lookup = {str(did): {"id": str(did), "name": name} for did, name in d_rows}

    def resolve_target(r) -> dict | None:
        if not r.target_id:
            return None
        tid = str(r.target_id)
        tt = r.target_type or ""
        if tt == "user":
            u = users_lookup.get(tid)
            return {
                "type": tt,
                "id": tid,
                "label": u["full_name"] if u else None,
                "sublabel": u["email"] if u else None,
            }
        if tt == "course":
            c = courses_lookup.get(tid)
            return {
                "type": tt,
                "id": tid,
                "label": c["title"] if c else None,
                "sublabel": None,
            }
        if tt == "section":
            s = sections_lookup.get(tid)
            return {
                "type": tt,
                "id": tid,
                "label": s["name"] if s else None,
                "sublabel": s["course_title"] if s else None,
            }
        if tt == "school":
            s = schools_lookup.get(tid)
            return {
                "type": tt,
                "id": tid,
                "label": s["name"] if s else None,
                "sublabel": s["code"] if s else None,
            }
        if tt == "tenant":
            d = districts_lookup.get(tid)
            return {
                "type": tt,
                "id": tid,
                "label": d["name"] if d else None,
                "sublabel": None,
            }
        if tt == "enrollment":
            # target_id is a student for enrollment events
            u = users_lookup.get(tid)
            return {
                "type": tt,
                "id": tid,
                "label": u["full_name"] if u else None,
                "sublabel": u["email"] if u else None,
            }
        if tt == "parent_student":
            return {"type": tt, "id": tid, "label": None, "sublabel": None}
        return {"type": tt, "id": tid, "label": None, "sublabel": None}

    enriched_items: list[dict] = []
    for r in rows:
        md = r.event_metadata or {}
        student_key = md.get("student_id")
        parent_key = md.get("parent_id")
        user_key = md.get("user_id")
        course_md_key = md.get("course_id")
        section_md_key = md.get("section_id")

        bulk_students: list[dict] = []
        for raw in md.get("student_ids") or []:
            u = users_lookup.get(str(raw))
            if u:
                bulk_students.append(u)

        enriched_items.append({
            "id": str(r.id),
            "tenant_id": str(r.tenant_id),
            "actor_user_id": str(r.actor_user_id) if r.actor_user_id else None,
            "actor_email": r.actor_email,
            "actor_role": r.actor_role,
            "action": r.action,
            "target_type": r.target_type,
            "target_id": str(r.target_id) if r.target_id else None,
            "summary": r.summary,
            "ip_address": r.ip_address,
            "user_agent": r.user_agent,
            "event_metadata": md,
            "created_at": r.created_at,
            "target": resolve_target(r),
            "student": users_lookup.get(str(student_key)) if student_key else None,
            "parent": users_lookup.get(str(parent_key)) if parent_key else None,
            "subject_user": users_lookup.get(str(user_key)) if user_key else None,
            "course": courses_lookup.get(str(course_md_key)) if course_md_key else None,
            "section": sections_lookup.get(str(section_md_key)) if section_md_key else None,
            "students": bulk_students,
        })

    return {
        "items": enriched_items,
        "total": paginated.total,
        "page": paginated.page,
        "page_size": paginated.page_size,
        "pages": paginated.pages,
    }
