---
description: "Implement the Parent role, parent-child linking, and a read-only parental portal for viewing child's grades, attendance, and upcoming assignments"
name: "Implement Parent Role & Portal"
argument-hint: "Run to add parent role, ParentStudent model, and parent-scoped API endpoints"
agent: "agent"
---

You are implementing the Parent role and Parental Portal for the LMS. Parents are guardians who monitor their child's academic progress with read-only access to grades, attendance, and due dates.

## Requirements

### Add Parent Role
In `backend/app/core/permissions.py`:
- Add `PARENT = "parent"` to the `Role` enum
- Update `ROLE_HIERARCHY` to include parent (suggested placement: between STUDENT and TEACHER? Or after STUDENT?)
  - Recommendation: `ROLE_HIERARCHY = [STUDENT, PARENT, TEACHER, ADMIN, SUPERADMIN]` 
  - (Parent ≈ student privileges + no submission rights + cross-child visibility)

### Database Model: ParentStudent Link
Create `backend/app/models/parent.py` with:
- `ParentStudent` model (association table):
  - `id: UUID` (PK, optional or auto)
  - `parent_id: UUID` (FK → users, indexed) — the parent user
  - `student_id: UUID` (FK → users, indexed) — the child they monitor
  - `relationship: str | None` (e.g., "mother", "father", "guardian", "other") — optional for label
  - `verified_at: DateTime | None` — when link was confirmed (initially NULL; admin must approve)
  - `is_active: bool` (default True)
  - `tenant_id: UUID` (FK → districts, indexed)
  - UNIQUE constraint: (parent_id, student_id, tenant_id)
  - Relationships: `parent_user`, `student_user`, `district`

**Why separate table?**
- One parent can have multiple children
- One child can have multiple parents/guardians
- Verified_at allows admin approval workflow before access

### Pydantic Schemas
Create `backend/app/schemas/parent.py` with:
- `ParentStudentCreate`: student_id, relationship (optional)
- `ParentStudentRead`: id, parent_id, student (UserSummary), relationship, verified_at, is_active, created_at
- `ChildSummary`: id, full_name, email, avatar_url (basic child profile for parent to see list)
- `ChildDetailedSummary`: extends ChildSummary with last_login_at, enrolled_courses (count), avg_grade, assignments_due_count

### Service Layer
Create `backend/app/services/parent_service.py` with:
- `get_children(parent_id, tenant_id)` → list[ChildDetailedSummary]
  - Filters `ParentStudent` where parent_id matches AND is_active=True AND verified_at IS NOT NULL
  - Joins child User with eager-loaded grades, enrollments

- `verify_parent_child_link(link_id, admin_id)` → ParentStudentRead
  - Admin approves pending parent-child link
  - Sets verified_at = now
  - Raises ForbiddenError if not admin or link not found

- `can_parent_view_child(parent_id, child_id, tenant_id)` → bool
  - Returns True if verified parent-child link exists
  - Used in permission checks

- `get_child_grades(parent_id, child_id, tenant_id)` → list[StudentGradeSummary]
  - Verifies parent has access via `can_parent_view_child()`
  - Returns child's grades (posted only)
  - Raises ForbiddenError if no verified link

- `get_child_attendance(parent_id, child_id, tenant_id, course_id=None)` → AttendanceReport | list[Attendance]
  - Similar permission check
  - Returns attendance for child (optionally filtered to course)

- `get_child_upcoming_assignments(parent_id, child_id, tenant_id)` → list[AssignmentWithDueDate]
  - Finds child's enrolled courses
  - Collects assignments/quizzes with due_at in future
  - Sorted by due_at ascending
  - Returns: title, course_name, due_at, status (submitted | not started)

- `request_parent_child_link(email, child_id, tenant_id)` → ParentStudentRead (unverified)
  - Called by student or admin: "invite parent to monitor me"
  - Creates ParentStudent record with verified_at=NULL
  - Sends email invite to parent with magic link or code
  - Returns unverified link

### REST API
Create `backend/app/api/v1/parent.py` with endpoints:

**Parent endpoints (protected, requires PARENT role):**
- `GET /parents/me/children`
  - Permission: PARENT role
  - Returns: list[ChildDetailedSummary] (children linked to logged-in parent)

- `GET /parents/me/children/{child_id}/grades`
  - Permission: verified PARENT link to child
  - Returns: list[StudentGradeSummary]
  - (Reuse schemas from existing grades.py; filter to parent's child)

- `GET /parents/me/children/{child_id}/attendance?course_id=...`
  - Permission: verified PARENT link
  - Params: course_id (optional; all courses if omitted)
  - Returns: AttendanceReport (reuse from attendance feature)

- `GET /parents/me/children/{child_id}/upcoming-assignments`
  - Permission: verified PARENT link
  - Returns: list with fields [title, course_id, course_name, type (quiz | assignment), due_at, status, url (link to assignment)]
  - Status: "not_started" | "in_progress" | "submitted" | "graded"

- `GET /parents/me/notifications`
  - Permission: PARENT role
  - Returns: filtered Notification list (only grade_posted, attendance alerts, deadline warnings, messages from teachers)
  - Params: page, page_size

**Student endpoints (link parent workflow):**
- `POST /students/me/parent-links`
  - Input: `{parent_email, relationship (optional)}` — student invites a parent
  - Logic: calls `parent_service.request_parent_child_link()`, sends email invite
  - Returns: ParentStudentRead (unverified)
  - Email contains: "Click here to accept link to monitor [student name]" with magic link

- `GET /students/me/parent-links`
  - Returns: list of ParentStudentRead (both verified and pending)
  - Pending ones show: awaiting parent acceptance

**Admin endpoints (parent approval & management):**
- `GET /admin/parent-links?verified=...&student_id=...`
  - Permission: ADMIN or SUPERADMIN
  - Params: verified (true | false | null for all), student_id (optional)
  - Returns: paginated list[ParentStudentRead]

- `PATCH /admin/parent-links/{link_id}/verify`
  - Permission: ADMIN or SUPERADMIN
  - Logic: calls `parent_service.verify_parent_child_link()`
  - Returns: updated ParentStudentRead

- `DELETE /admin/parent-links/{link_id}`
  - Permission: ADMIN or SUPERADMIN
  - Sets is_active = False (soft delete)
  - Returns: MessageResponse

### Frontend Components
Create pages:
- **ParentDashboard** (`frontend/src/pages/parent/ParentDashboard.tsx`)
  - Lists children with cards (name, current average grade, missing assignments count)
  - Click child → ChildDetailPage

- **ChildDetailPage** (`frontend/src/pages/parent/ChildDetailPage.tsx`)
  - Tabs: Grades | Attendance | Upcoming Assignments | Messages
  - Grades tab: table of GradeEntry with course, score, letter grade
  - Attendance tab: chart + table (% present, absent, tardy)
  - Assignments tab: list with due dates, status badges
  - Messages tab: recent messages from child's teachers

- **ParentNotifications** (`frontend/src/pages/parent/ParentNotifications.tsx`)
  - Filtered notification list (no system/admin notifications)
  - Mark as read

### Validation Rules
- Only verified (verified_at is not null) parent-child links grant access
- Admin must approve before parent sees any child data
- Parent can only view their linked children (multi-tenancy enforced)
- Read-only: parent cannot edit grades, attendance, or assignments
- Parent cannot message students directly (use existing thread messaging, but you may want "student-teacher-parent" group messages in future)

### Email Invitation Flow
- When parent link created: send email to parent_email with:
  - Subject: "[Parent] [Student Name] invites you to monitor their grades"
  - Body: "Accept this invitation to view [student name]'s grades, attendance, and assignments at [school name]"
  - Link: `{frontend_url}/auth/accept-parent-link?token=...` (contains signed JWT or hash with link_id)

### Key Integration Points
- Update `useAuth()` hook in frontend to check for PARENT role
- Add parent routes to frontend router:
  ```
  /parent
    /dashboard
    /children/:childId/grades
    /children/:childId/attendance
    /children/:childId/assignments
    /notifications
  ```
- Navbar/sidebar: different layout for parent vs student vs teacher
- Permissions in [backend/app/core/permissions.py](backend/app/core/permissions.py): add `has_parent_link(parent_id, child_id, tenant_id)` helper

## Related Files (Reference These Patterns)
- User model & relationships: `backend/app/models/user.py`
- Grade schemas: `backend/app/schemas/grade.py` (StudentGradeSummary)
- Notification model: `backend/app/models/notification.py`
- Permission checks: `backend/app/api/v1/courses.py` (examples of `require_roles()`, ownership checks)
- Email service: `backend/app/workers/tasks/notifications.py` (extend with parent link emails)

## Checklist
- [ ] Add PARENT to Role enum + ROLE_HIERARCHY
- [ ] Create ParentStudent model + add to base.py imports
- [ ] Create parent schemas
- [ ] Implement parent_service.py
- [ ] Implement parent.py API router
- [ ] Update notification filtering (parents don't see all notifications)
- [ ] Seed demo data: create 1-2 parent users, link them to students in seed.py
- [ ] Frontend: create parent pages, add parent routes, update sidebar
- [ ] Test: parent login, view child's grades/attendance, verify can't edit

## Notes
- Parent email verification could be: magic link (stateless) or confirmation code (token in DB)
- Future: parent can customize notification preferences (only grades below C, all attendance alerts, etc.)
- Consider: group messages (parent + teacher + student) for 3-way communication
- Consider: parent can request teacher to provide more detailed feedback
