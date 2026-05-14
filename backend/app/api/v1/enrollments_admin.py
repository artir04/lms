import csv
import io
import uuid

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
    limit: int = Query(50, ge=1, le=500),
):
    tenant_id = uuid.UUID(payload["tenant_id"])
    actions = (
        "enrollment.create",
        "enrollment.drop",
        "enrollment.transfer",
        "enrollment.csv_import",
    )
    query = (
        select(AuditLog)
        .where(AuditLog.tenant_id == tenant_id, AuditLog.action.in_(actions))
        .order_by(desc(AuditLog.created_at))
        .limit(limit)
    )
    rows = (await db.execute(query)).scalars().all()

    section_to_course: dict[str, str] = {}
    if course_id is not None:
        sec_rows = (
            await db.execute(
                select(Section.id, Section.course_id)
                .join(Course, Course.id == Section.course_id)
                .where(Course.tenant_id == tenant_id)
            )
        ).all()
        section_to_course = {str(sid): str(cid) for sid, cid in sec_rows}

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
        if section_id and md.get("section_id") != str(section_id) and md.get("to_section_id") != str(section_id) and md.get("from_section_id") != str(section_id):
            return False
        if student_id and md.get("student_id") != str(student_id):
            return False
        return True

    filtered = [r for r in rows if matches(r)]
    return [
        {
            "action": r.action,
            "target_id": r.target_id,
            "summary": r.summary,
            "actor_email": r.actor_email,
            "event_metadata": r.event_metadata,
            "created_at": r.created_at,
        }
        for r in filtered
    ]
