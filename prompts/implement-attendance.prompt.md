---
description: "Implement the Attendance model, database schema, service layer, and REST API endpoints for teacher attendance tracking"
name: "Implement Attendance Feature"
argument-hint: "Run to scaffold out the complete attendance system (model → schema → service → API)"
agent: "agent"
---

You are implementing the Attendance feature for the LMS. This is a core feature that teachers use daily to mark students present, absent, or tardy.

## Requirements

### Database Model
Create `backend/app/models/attendance.py` with:
- `Attendance` model inheriting from `UUIDPrimaryKeyMixin, TimestampMixin`
- Fields:
  - `course_id: UUID` (FK → courses, indexed)
  - `section_id: UUID` (FK → sections, optional but prioritized)
  - `student_id: UUID` (FK → users, indexed)
  - `teacher_id: UUID` (FK → users, who recorded attendance)
  - `date: Date` (the class date)
  - `status: str` with values: `"present" | "absent" | "tardy"` (use Enum or string)
  - `notes: str | None` (optional teacher notes, e.g., "doctor's note", "field trip")
  - `tenant_id: UUID` (FK → districts, indexed for multi-tenancy)
  - All relationships: `course`, `section`, `student`, `teacher`, `district`

### Pydantic Schemas
Create `backend/app/schemas/attendance.py` with:
- `AttendanceCreate`: date, student_id, status, notes (optional)
- `AttendanceUpdate`: status, notes (optional)
- `AttendanceRead`: id, date, student (UserSummary), status, notes, teacher (UserSummary), created_at, from_attributes=True
- `AttendanceReportRow`: student_id, student_name, email, attendance_count (total records), present_count, absent_count, tardy_count, attendance_rate (percentage)
- `AttendanceReport`: course_id, date_range_start, date_range_end, rows (list[AttendanceReportRow])

### Service Layer
Create `backend/app/services/attendance_service.py` with methods:
- `get_attendance(course_id, date)` → list[Attendance] for that day
- `mark_attendance(course_id, section_id, date, records: list[AttendanceCreate])` → list[Attendance]
  - Validates: user is teacher or admin
  - Checks: date is in course date range
  - Creates/updates attendance records (upsert by date + student_id)
- `get_attendance_report(course_id, date_from, date_to)` → AttendanceReport
  - Groups by student_id
  - Calculates present/absent/tardy counts
  - Computes attendance_rate = present_count / total_records * 100
- `get_student_attendance(student_id, course_id)` → list[Attendance] (ordered by date DESC)
- `get_attendance_by_student(course_id, student_id, date_from=None, date_to=None)` → AttendanceReport for one student

### REST API
Create `backend/app/api/v1/attendance.py` with endpoints:

**Teacher endpoints:**
- `POST /courses/{course_id}/attendance`
  - Input: `{date: Date, records: [{student_id: UUID, status: str, notes?: str}]}`
  - Permission: requires TEACHER or ADMIN role + owns course
  - Returns: list[AttendanceRead]
  - Logic: call `attendance_service.mark_attendance()`

- `GET /courses/{course_id}/attendance?date_from=...&date_to=...`
  - Params: date_from (optional), date_to (optional, defaults to today)
  - Permission: TEACHER (own course) or ADMIN or SUPERADMIN
  - Returns: AttendanceReport

- `GET /courses/{course_id}/attendance/{student_id}?date_from=...&date_to=...`
  - Permission: TEACHER (own course) or ADMIN or SUPERADMIN
  - Returns: AttendanceReport for one student

**Student endpoints:**
- `GET /students/me/attendance?course_id=...`
  - Optional: filter by course_id, otherwise all enrolled courses
  - Permission: STUDENT (self only)
  - Returns: list of attendance records across courses with attendance_rate

**Parent endpoints (future, but structure the code to support):**
- `GET /parents/me/children/{child_id}/attendance?course_id=...`
  - Permission: verified parent link
  - Returns: read-only attendance of child

### Validation Rules
- Date must be in the past (cannot mark future attendance)
- Date must be within course date range if course has start/end dates
- Teacher creating attendance must own the course (or be admin)
- Cannot mark attendance for students not enrolled in the course
- Status must be one of: present, absent, tardy

## Integration Checklist
- [ ] Add `Attendance` to `backend/app/db/base.py` imports
- [ ] Add router to `backend/app/api/router.py` (include `attendance.router`)
- [ ] Add service instantiation in `dependencies.py` if needed
- [ ] Update permission checks: can teacher edit only today's attendance? Or historical? (allow admin to edit history, restrict teachers to today)
- [ ] Add sample attendance records in `backend/app/db/seed.py`
- [ ] Test: teacher marks 3 students present (one tardy); verify report shows correct counts

## Related Files (Reference These Patterns)
- Course model pattern: `backend/app/models/course.py`
- Quiz submission service (similar to attendance mark): `backend/app/services/assessment_service.py` `submit_answers()`
- Grade service (report pattern): `backend/app/services/grade_service.py` `get_gradebook()`
- Auth/permission checks: `backend/app/api/v1/courses.py` examples

## Notes
- Attendance is daily, not per-lesson. One date = one attendance status per student per course
- Consider: can a teacher mark attendance for past dates? Set a policy (e.g., retroactive for 2 weeks only)
- Future: sync with calendar / add to student schedule view
- Consider audit logging: log each attendance change with graded_by, graded_at
