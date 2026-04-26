# EduDitari LMS — User Guide

A complete catalog of every capability available in this Learning Management System,
organized by who can use what.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Roles & Access Model](#2-roles--access-model)
3. [Getting Started](#3-getting-started)
4. [Common Features (any signed-in user)](#4-common-features-any-signed-in-user)
5. [Student Capabilities](#5-student-capabilities)
6. [Teacher Capabilities](#6-teacher-capabilities)
7. [Admin Capabilities](#7-admin-capabilities)
8. [Superadmin Capabilities](#8-superadmin-capabilities)
9. [Parent Capabilities](#9-parent-capabilities)
10. [System & Background Operations](#10-system--background-operations)
11. [Known Limitations](#11-known-limitations)
12. [Full API Reference](#12-full-api-reference)

---

## 1. Overview

EduDitari is a multi-tenant Learning Management System where one platform instance
serves multiple **districts** (tenants), each containing **schools** and **users**.
The platform supports five distinct roles, course delivery, quizzes, grading,
attendance, parent visibility into student progress, and gamification.

**Tech stack:** FastAPI + SQLAlchemy (async) + PostgreSQL on the backend; React +
TypeScript + Vite + Tailwind on the frontend; Redis + Celery for background work.

**Service URLs (local Docker):**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Swagger / OpenAPI: http://localhost:8000/api/docs

---

## 2. Roles & Access Model

### Tenant hierarchy

```
District (tenant)
└─ School
   └─ Users (each user belongs to one district + one school)
```

A user's `tenant_id` (district) and `school_id` are baked into their record. JWTs
carry the `tenant_id` and `roles` claim, and every protected endpoint scopes data
to the caller's tenant.

### Role hierarchy

| Role | Inherits from | Typical use |
|---|---|---|
| **Superadmin** | All | Cross-tenant operator. Manages districts, schools, all users everywhere. |
| **Admin** | Teacher capabilities | School admin. Manages users, courses, runs reports, configures tenant. |
| **Teacher** | Student-readable views | Owns courses. Builds content, marks attendance, grades work. |
| **Parent** | (limited, child-scoped) | Read-only window into their linked children's progress. |
| **Student** | (own data only) | Consumes courses, takes quizzes, views own grades/attendance. |

The backend enforces roles via `require_roles(...)` decorators on each route.
Where a route lists multiple roles, **any** of them grants access. The frontend
mirrors this with `<ProtectedRoute roles={[...]}>` route wrappers.

> **Note:** "Inherits from" describes capability overlap — admins can do everything
> teachers can on the same routes, etc. There is no automatic role-claim escalation;
> each user is assigned roles explicitly via the `user_roles` table.

---

## 3. Getting Started

### 3.1 Demo credentials (seeded data)

The `lincoln-unified` district is seeded automatically on first boot with:

| Role | Email | Password |
|---|---|---|
| Superadmin | `superadmin@lms.example.com` (org: `system`) | `SuperAdmin123!` |
| Admin | `admin@lincoln-unified.edu` | `Admin123!` |
| Admin (school 2) | `admin2@lincoln-unified.edu` | `Admin123!` |
| Teacher | `sarah.chen@lincoln-unified.edu` (and 19 more) | `Teacher123!` |
| Student | `student001@lincoln-unified.edu` … `student100@…` | `Student123!` |
| Parent | `parent001@lincoln-unified.edu` … `parent050@…` | `Parent123!` |

The seed script also creates 20 teachers, 100 students, 50 parents (linked to
students 1–50), 20 courses with quizzes, attendance history, and grade entries.

### 3.2 Logging in

Open `/login`, then enter:
1. **Organization** — the district slug (e.g., `lincoln-unified`)
2. **Email**
3. **Password**

Multi-tenant means the same email can exist in different districts; the slug
disambiguates. The superadmin account uses org `system`.

### 3.3 Forgot password / reset password

- On the login page click **"Forgot password?"** (next to the password label).
- Enter your organization slug + email. The endpoint always returns
  "*If an account exists, a reset link has been sent*" regardless of whether the
  account exists, so account enumeration is not possible.
- Because email is `console`-mode in dev, **the reset link is logged to the
  backend stdout** instead of being emailed. To find it, run:
  ```bash
  docker compose logs backend --since 1m | grep password-reset
  ```
- Open the link, set a new password (min 8 chars). The page redirects to login on
  success. The reset token is a JWT with a 1-hour expiry.

### 3.4 Logout

Available from the user menu in the top bar (clears tokens and React Query cache).

### 3.5 Profile management

Any signed-in user can:
- View their profile via `GET /api/v1/users/me`
- Update first/last name etc. via `PATCH /api/v1/users/me`
- Change their own password via `POST /api/v1/users/me/change-password`
  (requires the current password)

---

## 4. Common Features (any signed-in user)

These pages and actions are available to **every** authenticated role.

### 4.1 Dashboard — `/dashboard`

Role-aware overview. Shows:
- Stat cards (counts vary by role: enrolled courses, active students, etc.)
- "What's Due Next" — upcoming quizzes/assignments for students; teaching summary for teachers
- Engagement chart with a 7d / 14d / 30d toggle (calls `GET /analytics/engagement`)
- Quick-link cards to courses, grades, etc.

### 4.2 Course list — `/courses`

- Browse all courses visible to your role (students see only published; teachers/admins see all in their tenant)
- Search by title (debounced 400 ms; calls `GET /courses?search=`)
- Pagination (Previous / Next)
- Click a course card → course detail page

### 4.3 Course detail — `/courses/:courseId`

Tabs:
1. **Content** — module/lesson tree. Click a lesson to open it.
2. **Class List** — enrolled students with name + email
3. **Quizzes** — list of quizzes; "Start Quiz" (student) or "Build Quiz" (teacher)
4. **Grades** — student-view grade summary OR teacher gradebook entry

Teacher/admin role only: extra action buttons for edit course, mark attendance, attendance report, gradebook.

### 4.4 Lesson view — `/courses/:courseId/lessons/:lessonId`

- Renders text / video / embed / file attachments based on `content_type`
- Downloads are served from `/media/<storage_key>` (local file storage)
- Opening a lesson logs a `lesson_view` analytics event automatically

### 4.5 Notifications

- `GET /api/v1/notifications` — paginated list of notifications for the current user
- `POST /api/v1/notifications/read` — mark a batch as read (send `notification_ids: [...]`)
- `WebSocket /api/v1/notifications/ws?token=<access_token>` — real-time push channel; connection rejected with code 4001 if the token fails

### 4.6 Gamification — `/gamification`

- Personal point total + earned badges with descriptions and dates
- Recent activity log (reason + points)
- Global leaderboard (top 20 by default; tunable up to 100)
- Calls: `GET /gamification/me` and `GET /gamification/leaderboard?limit=20`

### 4.7 Course-level data anyone can read

- Course sections: `GET /courses/{courseId}/sections`
- Modules: `GET /courses/{courseId}/modules`
- Lessons in a module: `GET /courses/{courseId}/modules/{moduleId}/lessons`
- Lesson detail: `GET /courses/{courseId}/lessons/{lessonId}`
- Quizzes in course: `GET /assessments/courses/{courseId}/quizzes`
- Quiz detail: `GET /assessments/quizzes/{quizId}` (students see questions/options but not the `is_correct` flag)
- Roster: `GET /courses/{courseId}/enrollments`

---

## 5. Student Capabilities

Everything in §4 plus:

### 5.1 Take a quiz — `/quizzes/:quizId/take`

- Render is type-aware: multiple-choice (radio), true/false (button pair), short-answer (text), essay (textarea)
- Submit answers → `POST /assessments/quizzes/{quizId}/submissions`
- Auto-graded MCQ/TF questions return a score immediately; short-answer/essay show as ungraded until a teacher reviews them
- Result page: total score, per-question correctness icons, explanations (if the teacher provided any), and points earned
- The quiz UI enforces `max_attempts` — once exhausted, the page shows "No Attempts Remaining"

### 5.2 My grades — `/grades`

- Per-course breakdown: assignment list, weight, weighted average, final grade
- Calls `GET /gradebook/me` which returns a list of `StudentGradeSummary`
- Read-only

### 5.3 My attendance — `/attendance`

- Overall card: total days, present / absent / tardy / excused counters, attendance rate %
- Per-course expandable detail with date-by-date status
- Calls `GET /attendance/students/me` (optional `?course_id=` filter)
- Read-only

### 5.4 Upcoming assignments

Surfaced on the dashboard. Backed by `GET /gradebook/upcoming`, which returns
quizzes due in the future for the student's enrolled courses, sorted by due
date, with `attempts_used` and an `is_overdue` flag.

### 5.5 Earning points and badges

Badges and points are awarded automatically by the gamification service when:
- A student submits a quiz (auto-graded portion)
- (other awarders are wired into the assessment grading flow)

The student doesn't trigger this directly; they just see the result on `/gamification`.

---

## 6. Teacher Capabilities

Inherits everything in §4–§5 (teachers can view course content like a student) plus:

### 6.1 Create a course

- From `/courses` → "+ Create course" button (teacher / admin / superadmin)
- Modal form: title, description, subject, grade level, school
- `POST /courses`

### 6.2 Edit course details — `/courses/:courseId/edit`

- "Edit course" button opens a modal with title, description, subject, grade level
- Toggle published / draft via `POST /courses/{courseId}/publish` (boolean flip)
- `PATCH /courses/{courseId}` for non-publish field changes
- A teacher can only edit courses they own; admins/superadmins can edit any in the tenant

### 6.3 Build course content — `/courses/:courseId/edit`

**Modules:**
- Add module (title + optional description)
  → `POST /courses/{courseId}/modules`
- Drag modules to reorder (visual feedback while dragging)
  → `PUT /courses/{courseId}/modules/reorder` with `[{id, position}, …]`
- Update module → `PATCH /courses/{courseId}/modules/{moduleId}`
- Delete module (with confirmation)
  → `DELETE /courses/{courseId}/modules/{moduleId}`

**Lessons (inside a module):**
- Add lesson with title, content type (text / video / embed / file), duration
  → `POST /courses/{courseId}/modules/{moduleId}/lessons`
- Drag to reorder within a module
  → `PUT /courses/{courseId}/modules/{moduleId}/lessons/reorder`
- Update lesson → `PATCH /courses/{courseId}/lessons/{lessonId}`
- Upload file attachment (multipart form)
  → `POST /courses/{courseId}/lessons/{lessonId}/attachments`
  - File is stored locally under `MEDIA_ROOT` and served from `/media/<storage_key>`

### 6.4 Build a quiz — `/courses/:courseId/quizzes/:quizId/build`

- Create quiz via the course-detail "+ Quiz" button
  → `POST /assessments/courses/{courseId}/quizzes` with title, description, due_at, time_limit_min, max_attempts
- After creation you're redirected to the builder
- Edit quiz settings in a modal: title, instructions, time limit, max attempts, published toggle
  → `PATCH /assessments/quizzes/{quizId}`
- Add a question (MCQ / true-false / short-answer / essay) with text, points, options (mark correct), explanation
  → `POST /assessments/quizzes/{quizId}/questions`

### 6.5 View / grade submissions

- List all submissions for a quiz: `GET /assessments/quizzes/{quizId}/submissions`
- Open a single submission: `GET /assessments/submissions/{submissionId}`
- Manually grade (typically used for short-answer / essay): `PATCH /assessments/submissions/{submissionId}/grade`
  with `{ items: [{ question_id, grade }] }`

### 6.6 Gradebook — `/courses/:courseId/gradebook`

- Spreadsheet view: rows = students, columns = grade categories
- Click a cell → modal with label, category (quiz / exam / assignment / participation), grade (1–5 Kosovo scale), weight (0.05–1.0)
- Create entry → `POST /gradebook/courses/{courseId}/entries`
- Edit entry → `PATCH /gradebook/entries/{entryId}`
- Weighted averages and final grades recalculate live
- Weights default per category: quiz=30%, assignment=25%, participation=15%, exam=30%

### 6.7 Mark attendance — `/courses/:courseId/attendance`

- Date picker (max = today) loads existing records for that date
  → `GET /attendance/courses/{courseId}/date/{attendance_date}`
- Per-student status buttons: Present / Absent / Tardy / Excused
- "Mark All Present" quick-fill button
- Conditional notes field appears for Absent and Tardy
- Save batch
  → `POST /attendance/courses/{courseId}` with `{ date, records: [{ student_id, status, notes }] }`

### 6.8 Attendance report — `/courses/:courseId/attendance/report`

- Date range filters (From / To) with reset button
- Overall stats: total records, average attendance rate, total absences, total tardies
- Per-student table, sorted by attendance rate descending
- Color coding: ≥90% green, ≥75% amber, <75% red
- "Export CSV" downloads a file with columns: Student, Email, Total Days, Present, Absent, Tardy, Rate
- Calls `GET /attendance/courses/{courseId}?date_from=…&date_to=…`

### 6.9 Analytics — `/analytics`

- Date range dropdown: 7d / 14d / 30d / 90d
- KPI cards: total students, total courses, average grade, active users today
  → `GET /analytics/dashboard`
- Engagement line chart over the chosen range
  → `GET /analytics/engagement?days=N`
- Per-course grade distribution available via `GET /analytics/grade-distribution/{courseId}` (used by the gradebook page, not a standalone screen)

### 6.10 Enrollment management

- Enroll a student in a section: `POST /courses/{courseId}/sections/{sectionId}/enroll` (admin/superadmin only)
- Drop a student: `DELETE /courses/{courseId}/sections/{sectionId}/enroll/{studentId}`
- Create a section: `POST /courses/{courseId}/sections`

---

## 7. Admin Capabilities

Inherits everything in §4–§6 plus:

### 7.1 User management — `/admin/users`

- Searchable list of all users in the tenant (debounced search)
- Filter by role (All / Students / Teachers / Admins)
- Pagination
- "+ Create user" modal: first name, last name, email, optional password (leave blank for SSO-only), role
  → `POST /users`
- Update user → `PATCH /users/{userId}` (admin / superadmin only)
- Soft-delete user (deactivate) → `DELETE /users/{userId}`
- Per-user fields displayed: avatar, name, email, role badge, active/inactive status, join date
- Calls `GET /users?page=&page_size=&role=&search=`

### 7.2 Reports — `/admin/reports`

- KPI cards: total students, total teachers, total parents, total courses
- Secondary stats: active users in last 30 days, platform-wide average grade, platform-wide attendance rate
- Per-course breakdown table: course title, teacher name, enrolled count, avg grade, attendance rate (color-coded)
- "Export CSV" with columns: Course, Teacher, Enrolled, Avg Grade, Attendance Rate
- Calls `GET /analytics/reports`

### 7.3 Platform settings — `/admin/settings`

Three tabs:

**General:**
- Platform name
- Support email
- Timezone (Europe/Belgrade, Europe/London, America/New_York, America/Chicago)
- Academic year string (e.g., `2025-2026`)
- Grading system (Kosovo 1-5 / Letter A-F / Percentage)
- Allow student self-enrollment (checkbox)

**Roles & Permissions:** read-only reference card describing each role's capabilities.

**Security:**
- Session timeout in minutes
- Max login attempts
- Password minimum length
- Require uppercase letters
- Require numbers
- Enable 2FA (checkbox; *informational — not actually enforced yet*)

Save flow:
- Each tab's "Save" button calls `PATCH /tenants/me/settings` with that tab's values namespaced under `general` or `security`.
- The PATCH **merges** into the existing settings JSON, so saving "Security" doesn't clear "General" and vice-versa.
- Settings reload from `GET /tenants/me/settings` on page load.

### 7.4 Parent–student linking

- `POST /parents/link` with `{ parent_id, student_id }` (admin/superadmin only)
- Currently no dedicated UI screen; reachable via Swagger or by an admin building a quick form.

---

## 8. Superadmin Capabilities

Inherits everything in §4–§7 plus:

### 8.1 District (tenant) management

- List all districts: `GET /tenants?page=&page_size=`
- Create district: `POST /tenants` with `{ name, slug, sso_provider?, sso_config?, settings? }`
- Get district by id: `GET /tenants/{districtId}`
- Update district: `PATCH /tenants/{districtId}` (any field including `is_active`)

These endpoints don't have a dedicated UI screen; they're reachable from
`/admin/settings` (for the current tenant's settings) and Swagger
(`http://localhost:8000/api/docs`) for full CRUD.

### 8.2 Cross-tenant access

A superadmin's JWT carries `roles: ["superadmin"]` and bypasses tenant scoping
on user/course/etc. routes that gate on tenant. In practice this means
superadmin tokens can create/read/update/delete records across every district.

---

## 9. Parent Capabilities

Parents have a separate, restricted view that only exposes data about their
linked children.

### 9.1 Parent dashboard — `/parent`

- Card per linked child: courses count, weighted average, attendance %
- Click a child to expand details
- Calls `GET /parents/digest` for the multi-child summary

### 9.2 Per-child progress (when a child is selected)

- Attendance summary: total days, present, absent, tardy, attendance rate
- Course grades table: course, assignment count, weighted avg, final grade
- Upcoming assignments: title, course, due date, submitted/pending badges
- Calls `GET /parents/children/{studentId}/progress`

### 9.3 What parents *cannot* do

- Cannot access courses directly, take quizzes, view other students' data,
  message anyone, or change any data. Their token's role is checked at every parent
  route (only the `parent` role qualifies).

---

## 10. System & Background Operations

These run without user interaction.

### 10.1 Database initialization & seeding

- On backend startup (`lifespan` in `app/main.py`), `init_db()` creates the
  superadmin account and the system district if missing.
- The `seeder` Compose service runs `python -m app.db.seed` once and populates
  the `lincoln-unified` district with full demo data (district, schools,
  20 teachers, 100 students, 50 parents, 20 courses with modules/lessons/quizzes,
  attendance history, grade entries, and 8 weeks of report snapshots).

### 10.2 Celery workers

Two Celery services run alongside the API:

- **worker** — picks up async tasks from the queue
- **beat** — schedules periodic tasks

**Scheduled task:** `nightly-analytics` (`generate_nightly_snapshots`) — runs
once per day (86400 s). Writes daily `ReportSnapshot` rows that feed the
admin reports page. *Implementation is currently a placeholder; it does not
fill in real metrics.*

**Defined but not scheduled / not yet implemented:**
- `send_email_notification(to, subject, body)` — exists; only logs to stdout
  (because `EMAIL_BACKEND=console`)
- `send_deadline_reminders` — task body is empty; not scheduled

### 10.3 Real-time notifications (WebSocket)

`WebSocket /api/v1/notifications/ws?token=<access_token>` opens a real-time
channel. The server pushes new notifications as they're created. Auth failures
close the socket with code 4001.

### 10.4 Analytics event capture

Opening a lesson via `GET /courses/{courseId}/lessons/{lessonId}` writes a
`lesson_view` analytics event. This feeds the engagement chart on the dashboard
and analytics page.

### 10.5 Static file serving

Lesson attachments are uploaded to `MEDIA_ROOT` (default `/app/media` inside
the container) and served back at `/media/<storage_key>`. The attachment
upload endpoint returns the storage key + a signed URL.

---

## 11. Known Limitations

These are documented gaps — features that are partially scaffolded but not
fully wired up. They've been left in place because the project is local-only.

| Area | What's missing |
|---|---|
| **SSO** | `GET /auth/sso/{provider}` returns a hardcoded Google URL regardless of provider. No callback endpoint, no token exchange. `GOOGLE_*` / `MICROSOFT_*` env vars are dead. |
| **Email** | `EMAIL_BACKEND=console` — emails (including password-reset links) only log to backend stdout. No SMTP path is implemented. |
| **S3 storage** | `STORAGE_BACKEND=s3` is a config option but `content_service.py` only writes locally. AWS env vars are unused. |
| **Celery `send_deadline_reminders`** | Task body is empty and the task is not in the beat schedule. |
| **Analytics snapshot** | `generate_nightly_snapshots` body is also a placeholder. |
| **Tests** | No `tests/` directory. Zero automated test coverage. |
| **2FA toggle** | The "Enable 2FA" checkbox in admin settings persists the value but no 2FA flow is implemented. |

---

## 12. Full API Reference

All routes are prefixed with `/api/v1`. JSON body unless otherwise noted.
Auth is `Authorization: Bearer <access_token>` for protected routes.

### Auth — `/auth`

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/auth/login` | public | Authenticate with email + password + tenant_slug. Returns access + refresh tokens. |
| POST | `/auth/refresh` | public | Exchange a refresh token for a fresh access + refresh token pair. |
| POST | `/auth/forgot-password` | public | Email + tenant_slug. Always returns 200 (no enumeration). Logs reset link in dev. |
| POST | `/auth/reset-password` | public | Token + new_password. Sets new password if token is valid. |
| GET | `/auth/sso/{provider}` | public | **Stub.** Returns a placeholder Google redirect URL. |

### Users — `/users`

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/users/me` | any | Current user profile. |
| PATCH | `/users/me` | any | Update own profile fields. |
| POST | `/users/me/change-password` | any | Requires current_password and new_password. |
| GET | `/users` | admin / superadmin | Paginated list. Filters: `search`, `role`, `page`, `page_size`. |
| POST | `/users` | admin / superadmin | Create user in current tenant. |
| GET | `/users/{user_id}` | any | Read user (tenant-scoped). |
| PATCH | `/users/{user_id}` | admin / superadmin | Update user. |
| DELETE | `/users/{user_id}` | admin / superadmin | Soft-delete (deactivate). |

### Tenants — `/tenants`

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/tenants` | superadmin | List districts. |
| POST | `/tenants` | superadmin | Create a district. |
| GET | `/tenants/{district_id}` | superadmin | Read a district. |
| PATCH | `/tenants/{district_id}` | superadmin | Update a district. |
| GET | `/tenants/me/settings` | admin / superadmin | Read current tenant settings JSON. |
| PATCH | `/tenants/me/settings` | admin / superadmin | Merge-patch settings JSON. |

### Courses — `/courses`

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/courses` | any | Paginated list (students see published only). Search supported. |
| POST | `/courses` | teacher / admin / superadmin | Create course. |
| GET | `/courses/{course_id}` | any | Course detail. |
| PATCH | `/courses/{course_id}` | teacher (owner) / admin / superadmin | Update course. |
| POST | `/courses/{course_id}/publish` | teacher / admin | Toggle is_published. |
| GET | `/courses/{course_id}/sections` | any | List sections. |
| POST | `/courses/{course_id}/sections` | teacher / admin | Create section. |
| GET | `/courses/{course_id}/enrollments` | any | Roster (id, full_name, email). |
| POST | `/courses/{course_id}/sections/{section_id}/enroll` | admin / superadmin | Enroll a student. |
| DELETE | `/courses/{course_id}/sections/{section_id}/enroll/{student_id}` | admin / superadmin | Drop a student. |

### Content — `/courses/{course_id}/...`

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/modules` | any | List modules with lesson_count. |
| POST | `/modules` | teacher / admin | Create module. |
| PATCH | `/modules/{module_id}` | teacher / admin | Update module. |
| DELETE | `/modules/{module_id}` | teacher / admin | Delete module. |
| PUT | `/modules/reorder` | teacher / admin | Reorder modules. |
| GET | `/modules/{module_id}/lessons` | any | List lessons. |
| POST | `/modules/{module_id}/lessons` | teacher / admin | Create lesson. |
| PUT | `/modules/{module_id}/lessons/reorder` | teacher / admin | Reorder lessons. |
| GET | `/lessons/{lesson_id}` | any | Lesson detail (logs `lesson_view`). |
| PATCH | `/lessons/{lesson_id}` | teacher / admin | Update lesson. |
| POST | `/lessons/{lesson_id}/attachments` | teacher / admin | Upload file (multipart). |

### Assessments — `/assessments`

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/assessments/courses/{course_id}/quizzes` | any | List quizzes in course. |
| POST | `/assessments/courses/{course_id}/quizzes` | teacher / admin | Create quiz. |
| GET | `/assessments/quizzes/{quiz_id}` | any | Quiz detail (students get is_correct hidden). |
| PATCH | `/assessments/quizzes/{quiz_id}` | teacher / admin | Update quiz. |
| POST | `/assessments/quizzes/{quiz_id}/questions` | teacher / admin | Add a question. |
| POST | `/assessments/quizzes/{quiz_id}/submissions` | student | Submit answers (auto-grades MCQ/TF). |
| GET | `/assessments/quizzes/{quiz_id}/submissions` | teacher / admin | All submissions for a quiz. |
| GET | `/assessments/submissions/{submission_id}` | student (own) / teacher / admin | Submission detail. |
| PATCH | `/assessments/submissions/{submission_id}/grade` | teacher / admin | Manually grade items. |

### Grades — `/gradebook`

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/gradebook/courses/{course_id}` | teacher / admin | Course gradebook (students × entries). |
| POST | `/gradebook/courses/{course_id}/entries` | teacher / admin | Create grade entry. |
| PATCH | `/gradebook/entries/{entry_id}` | teacher / admin | Edit a grade entry. |
| GET | `/gradebook/me` | any (intended for student) | Current user's grades across courses. |
| GET | `/gradebook/upcoming` | any (intended for student) | Upcoming quizzes/assignments. |

### Attendance — `/attendance`

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/attendance/courses/{course_id}` | teacher (own) / admin / superadmin | Mark batch attendance for a date. |
| GET | `/attendance/courses/{course_id}` | teacher (own) / admin / superadmin | Course-level report (date range optional). |
| GET | `/attendance/courses/{course_id}/students/{student_id}` | teacher (own) / admin / superadmin | Single-student record. |
| GET | `/attendance/courses/{course_id}/date/{attendance_date}` | teacher (own) / admin / superadmin | Records for a specific date (used by marking page). |
| GET | `/attendance/students/me` | student | Own attendance summary across all courses. |

### Analytics — `/analytics`

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/analytics/dashboard` | teacher / admin | KPI summary (tenant- or teacher-scoped). |
| GET | `/analytics/engagement?days=N` | teacher / admin | Engagement counts and active user trend (7–365). |
| GET | `/analytics/grade-distribution/{course_id}` | teacher / admin | Grade histogram for a course. |
| GET | `/analytics/reports` | admin / superadmin | Whole-tenant admin report. |

### Gamification — `/gamification`

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/gamification/me` | any | Own points + badges + recent activity. |
| GET | `/gamification/leaderboard?limit=N` | any | Top students by points (max 100). |

### Parents — `/parents`

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/parents/digest` | parent | Multi-child progress digest. |
| GET | `/parents/children/{student_id}/progress` | parent | Detailed progress for one linked child. |
| POST | `/parents/link` | admin / superadmin | Link a parent to a student. |

### Notifications — `/notifications`

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/notifications` | any | Paginated list of notifications. |
| POST | `/notifications/read` | any | Mark batch as read (`{ notification_ids: [...] }`). |
| WS | `/notifications/ws?token=<jwt>` | any | Real-time push channel. |

### System

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/health` | public | Liveness check. Returns `{ status: "ok", version: "1.0.0" }`. |
| GET | `/api/docs` | public | Interactive Swagger UI. |
| GET | `/api/redoc` | public | ReDoc reference (alternative). |
| GET | `/media/<storage_key>` | public | Static file serving for uploaded attachments. |
