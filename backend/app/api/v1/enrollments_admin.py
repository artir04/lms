import csv
import io
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import and_, desc, or_, select
from sqlalchemy.orm import selectinload

from app.core.permissions import Role
from app.core.security import hash_password
from app.db.session import get_db
from app.dependencies import CurrentUserPayload, require_roles
from app.models.audit import AuditLog
from app.models.course import Course, Enrollment, Section
from app.models.user import Role as RoleModel, User, UserRole
from app.schemas.common import MessageResponse
from app.schemas.enrollment_admin import (
    CsvImportResult,
    CsvImportRow,
    EnrollmentTransfer,
)
from app.services.audit_service import AuditService

router = APIRouter(prefix="/admin/enrollments", tags=["admin-enrollments"])


@router.post(
    "/import-csv",
    response_model=CsvImportResult,
    dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)],
)
async def import_csv(
    payload: CurrentUserPayload,
    request: Request,
    section_id: uuid.UUID = Query(..., description="Section to enroll the imported students into"),
    file: UploadFile = File(...),
    create_missing: bool = Query(True, description="Create users for rows whose email does not exist"),
    db=Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be a .csv")

    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV is empty")
    headers = {h.strip().lower() for h in reader.fieldnames}
    required = {"email", "first_name", "last_name"}
    if not required.issubset(headers):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CSV must include columns: {sorted(required)} (case-insensitive)",
        )

    tenant_id = uuid.UUID(payload["tenant_id"])

    section_q = await db.execute(
        select(Section, Course)
        .join(Course, Course.id == Section.course_id)
        .where(Section.id == section_id, Course.tenant_id == tenant_id)
    )
    section_row = section_q.first()
    if not section_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    section_course_id = section_row[0].course_id

    student_role_q = await db.execute(select(RoleModel).where(RoleModel.name == "student"))
    student_role = student_role_q.scalar_one_or_none()
    if not student_role:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Student role not seeded")

    result_rows: list[CsvImportRow] = []
    created = 0
    enrolled = 0
    skipped = 0
    errors = 0
    affected_student_ids: list[str] = []

    for raw_row in reader:
        row = {(k or "").strip().lower(): (v or "").strip() for k, v in raw_row.items()}
        email = row.get("email", "").lower()
        first_name = row.get("first_name") or ""
        last_name = row.get("last_name") or ""

        if not email or not first_name or not last_name:
            errors += 1
            result_rows.append(CsvImportRow(
                email=email, first_name=first_name, last_name=last_name,
                status="error", detail="Missing required field",
            ))
            continue

        existing_user_q = await db.execute(
            select(User).where(User.email == email, User.tenant_id == tenant_id)
        )
        user = existing_user_q.scalar_one_or_none()
        row_status: str
        detail: str | None = None

        if not user:
            if not create_missing:
                skipped += 1
                result_rows.append(CsvImportRow(
                    email=email, first_name=first_name, last_name=last_name,
                    status="skipped", detail="User does not exist (create_missing=false)",
                ))
                continue
            user = User(
                tenant_id=tenant_id,
                email=email,
                first_name=first_name,
                last_name=last_name,
                password_hash=hash_password("ChangeMe123!"),
            )
            db.add(user)
            await db.flush()
            db.add(UserRole(user_id=user.id, role_id=student_role.id))
            await db.flush()
            created += 1
            row_status = "created_and_enrolled"
        else:
            row_status = "enrolled"

        existing_enr = await db.execute(
            select(Enrollment).where(
                Enrollment.section_id == section_id,
                Enrollment.student_id == user.id,
            )
        )
        enr = existing_enr.scalar_one_or_none()
        if enr:
            if enr.status == "active":
                skipped += 1
                result_rows.append(CsvImportRow(
                    email=email, first_name=first_name, last_name=last_name,
                    status="skipped", detail="Already enrolled in section",
                ))
                continue
            enr.status = "active"
        else:
            db.add(Enrollment(section_id=section_id, student_id=user.id, status="active"))
        await db.flush()
        enrolled += 1
        affected_student_ids.append(str(user.id))
        result_rows.append(CsvImportRow(
            email=email, first_name=first_name, last_name=last_name,
            status=row_status, detail=detail,
        ))

    await AuditService(db).record_from_payload(
        payload,
        action="enrollment.csv_import",
        target_type="section",
        target_id=section_id,
        summary=f"CSV import: {enrolled} enrolled, {created} created, {skipped} skipped, {errors} errors",
        request=request,
        metadata={
            "course_id": str(section_course_id),
            "section_id": str(section_id),
            "total_rows": len(result_rows),
            "created": created,
            "enrolled": enrolled,
            "skipped": skipped,
            "errors": errors,
            "student_ids": affected_student_ids,
        },
    )

    return CsvImportResult(
        total_rows=len(result_rows),
        created_users=created,
        enrolled=enrolled,
        skipped=skipped,
        errors=errors,
        rows=result_rows,
    )


@router.post(
    "/transfer",
    response_model=MessageResponse,
    dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)],
)
async def transfer_enrollment(
    data: EnrollmentTransfer,
    payload: CurrentUserPayload,
    request: Request,
    db=Depends(get_db),
):
    tenant_id = uuid.UUID(payload["tenant_id"])
    section_q = await db.execute(
        select(Section)
        .join(Course, Course.id == Section.course_id)
        .where(Section.id.in_([data.from_section_id, data.to_section_id]), Course.tenant_id == tenant_id)
    )
    sections = section_q.scalars().all()
    if len(sections) != 2:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or both sections not found in tenant")
    section_by_id = {s.id: s for s in sections}
    from_course_id = section_by_id[data.from_section_id].course_id
    to_course_id = section_by_id[data.to_section_id].course_id

    enr_q = await db.execute(
        select(Enrollment).where(
            Enrollment.section_id == data.from_section_id,
            Enrollment.student_id == data.student_id,
        )
    )
    from_enr = enr_q.scalar_one_or_none()
    if not from_enr or from_enr.status != "active":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student is not actively enrolled in the source section")

    from_enr.status = "dropped"

    dest_q = await db.execute(
        select(Enrollment).where(
            Enrollment.section_id == data.to_section_id,
            Enrollment.student_id == data.student_id,
        )
    )
    dest = dest_q.scalar_one_or_none()
    if dest:
        dest.status = "active"
    else:
        db.add(Enrollment(section_id=data.to_section_id, student_id=data.student_id, status="active"))
    await db.flush()

    await AuditService(db).record_from_payload(
        payload,
        action="enrollment.transfer",
        target_type="enrollment",
        target_id=data.student_id,
        summary="Transferred student between sections",
        request=request,
        metadata={
            "student_id": str(data.student_id),
            "from_section_id": str(data.from_section_id),
            "to_section_id": str(data.to_section_id),
            "from_course_id": str(from_course_id),
            "to_course_id": str(to_course_id),
            "course_id": str(to_course_id),
        },
    )
    return MessageResponse(message="Student transferred")


ENROLLMENT_HISTORY_ACTIONS = (
    "enrollment.create",
    "enrollment.drop",
    "enrollment.transfer",
    "enrollment.csv_import",
)


def _safe_uuid(value) -> uuid.UUID | None:
    if value is None:
        return None
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        return None


@router.get(
    "/history",
    dependencies=[require_roles(Role.ADMIN, Role.SUPERADMIN)],
)
async def list_enrollment_history(
    payload: CurrentUserPayload,
    db=Depends(get_db),
    course_id: uuid.UUID | None = None,
    section_id: uuid.UUID | None = None,
    student_id: uuid.UUID | None = None,
    actions: list[str] | None = Query(None, description="Filter by audit action (repeatable)"),
    date_from: datetime | None = Query(None, description="ISO start timestamp (inclusive)"),
    date_to: datetime | None = Query(None, description="ISO end timestamp (inclusive)"),
    limit: int = Query(100, ge=1, le=500),
):
    tenant_id = uuid.UUID(payload["tenant_id"])

    requested_actions: tuple[str, ...] = ENROLLMENT_HISTORY_ACTIONS
    if actions:
        clean = tuple(a for a in actions if a in ENROLLMENT_HISTORY_ACTIONS)
        if clean:
            requested_actions = clean

    query = select(AuditLog).where(
        AuditLog.tenant_id == tenant_id,
        AuditLog.action.in_(requested_actions),
    )
    if date_from is not None:
        query = query.where(AuditLog.created_at >= date_from)
    if date_to is not None:
        query = query.where(AuditLog.created_at <= date_to)

    # Pull a wider window before metadata filtering so the limit applies post-filter.
    fetch_limit = limit * 5 if (course_id or section_id or student_id) else limit
    query = query.order_by(desc(AuditLog.created_at)).limit(fetch_limit)
    rows = (await db.execute(query)).scalars().all()

    # Build section→course map (used both for course filtering and for display).
    sec_rows = (
        await db.execute(
            select(Section.id, Section.course_id, Section.name)
            .join(Course, Course.id == Section.course_id)
            .where(Course.tenant_id == tenant_id)
        )
    ).all()
    section_to_course: dict[str, str] = {str(sid): str(cid) for sid, cid, _ in sec_rows}
    section_name: dict[str, str] = {str(sid): name for sid, _, name in sec_rows}

    def row_course_ids(md: dict) -> set[str]:
        ids: set[str] = set()
        for key in ("course_id", "from_course_id", "to_course_id"):
            val = md.get(key)
            if val:
                ids.add(str(val))
        for key in ("section_id", "from_section_id", "to_section_id"):
            sec = md.get(key)
            if sec and str(sec) in section_to_course:
                ids.add(section_to_course[str(sec)])
        return ids

    def matches(r: AuditLog) -> bool:
        md = r.event_metadata or {}
        if course_id and str(course_id) not in row_course_ids(md):
            return False
        if section_id and str(section_id) not in (
            str(md.get("section_id") or ""),
            str(md.get("to_section_id") or ""),
            str(md.get("from_section_id") or ""),
        ):
            return False
        if student_id:
            target_str = str(student_id)
            in_single = md.get("student_id") == target_str
            in_bulk = any(str(x) == target_str for x in (md.get("student_ids") or []))
            if not (in_single or in_bulk):
                return False
        return True

    filtered = [r for r in rows if matches(r)][:limit]

    # Batch-resolve referenced courses, sections, and students for display.
    course_ids: set[uuid.UUID] = set()
    section_ids: set[uuid.UUID] = set()
    student_ids: set[uuid.UUID] = set()
    for r in filtered:
        md = r.event_metadata or {}
        for key in ("course_id", "from_course_id", "to_course_id"):
            cid = _safe_uuid(md.get(key))
            if cid:
                course_ids.add(cid)
        for key in ("section_id", "from_section_id", "to_section_id"):
            sid = _safe_uuid(md.get(key))
            if sid:
                section_ids.add(sid)
                # Section's parent course also worth resolving for display
                parent_cid = _safe_uuid(section_to_course.get(str(sid)))
                if parent_cid:
                    course_ids.add(parent_cid)
        stud_id = _safe_uuid(md.get("student_id"))
        if stud_id:
            student_ids.add(stud_id)
        # Many events store the affected student in target_id directly.
        if r.target_type in ("enrollment",) and r.target_id:
            student_ids.add(r.target_id)
        # CSV imports store an array of every imported student.
        for raw in md.get("student_ids") or []:
            arr_id = _safe_uuid(raw)
            if arr_id:
                student_ids.add(arr_id)

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
    for sid in section_ids:
        s_key = str(sid)
        if s_key in section_name:
            parent_course_id = section_to_course.get(s_key)
            sections_lookup[s_key] = {
                "id": s_key,
                "name": section_name[s_key],
                "course_id": parent_course_id,
                "course_title": courses_lookup.get(parent_course_id, {}).get("title") if parent_course_id else None,
            }

    students_lookup: dict[str, dict] = {}
    if student_ids:
        u_rows = (
            await db.execute(
                select(User.id, User.first_name, User.last_name, User.email)
                .where(User.id.in_(student_ids), User.tenant_id == tenant_id)
            )
        ).all()
        students_lookup = {
            str(uid): {
                "id": str(uid),
                "full_name": f"{fn} {ln}".strip(),
                "email": email,
            }
            for uid, fn, ln, email in u_rows
        }

    def resolve_course(md: dict, key: str) -> dict | None:
        cid = md.get(key)
        if not cid:
            return None
        return courses_lookup.get(str(cid))

    def resolve_section(md: dict, key: str) -> dict | None:
        sid = md.get(key)
        if not sid:
            return None
        return sections_lookup.get(str(sid))

    enriched: list[dict] = []
    for r in filtered:
        md = r.event_metadata or {}
        student_key = md.get("student_id") or (str(r.target_id) if r.target_type == "enrollment" and r.target_id else None)
        bulk_students: list[dict] = []
        for raw in md.get("student_ids") or []:
            resolved = students_lookup.get(str(raw))
            if resolved:
                bulk_students.append(resolved)
        enriched.append({
            "id": str(r.id),
            "action": r.action,
            "target_type": r.target_type,
            "target_id": str(r.target_id) if r.target_id else None,
            "summary": r.summary,
            "actor_email": r.actor_email,
            "actor_user_id": str(r.actor_user_id) if r.actor_user_id else None,
            "actor_role": r.actor_role,
            "ip_address": r.ip_address,
            "user_agent": r.user_agent,
            "event_metadata": md,
            "created_at": r.created_at,
            "student": students_lookup.get(str(student_key)) if student_key else None,
            "students": bulk_students,
            "course": resolve_course(md, "course_id"),
            "section": resolve_section(md, "section_id"),
            "from_course": resolve_course(md, "from_course_id"),
            "to_course": resolve_course(md, "to_course_id"),
            "from_section": resolve_section(md, "from_section_id"),
            "to_section": resolve_section(md, "to_section_id"),
        })
    return enriched
