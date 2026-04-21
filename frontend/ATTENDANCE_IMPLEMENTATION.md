# Attendance Feature - Frontend Implementation

## Overview
Complete frontend implementation for the attendance tracking system. The backend API was already implemented; this adds the corresponding frontend pages, components, and routing.

## Files Created

### 1. Types (`frontend/src/types/attendance.ts`)
- `AttendanceStatus`: Type for attendance statuses ('present', 'absent', 'tardy', 'excused')
- `AttendanceRecord`: Structure for a single attendance record
- `AttendanceCreateRequest`: Request payload for marking attendance
- `AttendanceRead`: Response data for attendance records
- `AttendanceReportRow`: Single student in attendance report
- `AttendanceReport`: Full course attendance report
- `StudentAttendanceSummary`: Student's attendance across courses
- `AttendanceByDate`: Attendance records for a specific date

### 2. API Functions (`frontend/src/api/attendance.ts`)
TanStack Query hooks for all attendance API calls:
- `useMarkAttendance()`: POST - Mark attendance for multiple students (teacher/admin/superadmin)
- `useAttendanceByDate()`: GET - Get attendance for a course on a specific date
- `useAttendanceReport()`: GET - Get attendance report with date filtering (teacher/admin/superadmin)
- `useStudentAttendance()`: GET - Get specific student's attendance in a course
- `useMyAttendance()`: GET - Students view their own attendance

### 3. Pages

#### AttendanceMarkingPage (`frontend/src/pages/attendance/AttendanceMarkingPage.tsx`)
**Access:** Teacher, Admin, Superadmin
**Route:** `/courses/:courseId/attendance`

Features:
- Date picker for attendance date
- List of all enrolled students
- Quick status buttons (Present, Absent, Tardy, Excused)
- Notes field for absent/tardy students
- "Mark All Present" quick action
- Real-time summary stats
- Loads existing attendance for date if already marked

#### StudentAttendancePage (`frontend/src/pages/attendance/StudentAttendancePage.tsx`)
**Access:** Student (authenticated)
**Route:** `/attendance`

Features:
- Overall attendance statistics across all courses
- Per-course breakdown with attendance rates
- Expandable course details showing individual records
- Color-coded status indicators
- Shows teacher who marked attendance
- Empty state for no records

#### AttendanceReportPage (`frontend/src/pages/attendance/AttendanceReportPage.tsx`)
**Access:** Teacher, Admin, Superadmin
**Route:** `/courses/:courseId/attendance/report`

Features:
- Date range filtering
- Export to CSV functionality
- Overall statistics (total records, avg rate, absences, tardies)
- Detailed student table with sorting by attendance rate
- Color-coded attendance rates (green ≥90%, yellow ≥75%, red <75%)
- Empty state for no data

### 4. Backend Additions

#### API Endpoint (`backend/app/api/v1/courses.py`)
- Added: `GET /courses/{course_id}/enrollments` - Returns enrolled students

#### Service Method (`backend/app/services/course_service.py`)
- Added: `list_enrollments()` - Returns list of enrolled students for a course

### 5. Routing Updates (`frontend/src/router/index.tsx`)
Added routes:
- `/attendance` - Student attendance view (all authenticated)
- `/courses/:courseId/attendance` - Mark attendance (teacher/admin/superadmin)
- `/courses/:courseId/attendance/report` - Attendance report (teacher/admin/superadmin)

### 6. Navigation Updates

#### Routes Config (`frontend/src/config/routes.ts`)
Added:
- `ATTENDANCE`: '/attendance'
- `COURSE_ATTENDANCE(id)`: `/courses/${id}/attendance`
- `COURSE_ATTENDANCE_REPORT(id)`: `/courses/${id}/attendance/report`

#### Sidebar (`frontend/src/components/layout/Sidebar.tsx`)
- Added "My Attendance" link to "Learning" section for students

#### Course Detail Page (`frontend/src/pages/courses/CourseDetailPage.tsx`)
- Added "Attendance" button for teachers/admins to access attendance marking

## Testing

### Test Data Available
- **Teacher:** sarah.chen@lincoln-unified.edu / Teacher123!
- **Course:** Algebra I (ID: 7c19d74e-7b08-4a29-af05-0f1b2f779283)
- **Students:** 3 enrolled students

### Test Scenarios

#### For Teachers/Admins:
1. Navigate to a course detail page
2. Click "Attendance" button
3. Select a date (default is today)
4. Mark attendance for each student
5. Add notes for absent/tardy students
6. Click "Save Attendance"
7. View the attendance report
8. Export report to CSV

#### For Students:
1. Click "My Attendance" in the sidebar
2. View overall attendance statistics
3. Expand courses to see detailed attendance records
4. Verify attendance rate calculations

## Role-Based Access
- **Students:** Can view their own attendance via `/attendance`
- **Teachers/Admins/Superadmins:** Can mark attendance and view reports via course pages

## API Endpoints Used

### POST `/api/v1/attendance/courses/{course_id}`
Mark attendance for multiple students on a date.

### GET `/api/v1/attendance/courses/{course_id}/date/{date}`
Get attendance records for a course on a specific date.

### GET `/api/v1/attendance/courses/{course_id}`
Get attendance report with optional date filtering (date_from, date_to).

### GET `/api/v1/attendance/students/me`
Get current student's attendance across all courses.

### GET `/api/v1/courses/{course_id}/enrollments` (NEW)
Get list of enrolled students for a course.

## Design Patterns Used

### Consistent with Existing Codebase
- TanStack Query for data fetching and caching
- React Hook Form for form handling
- Slate color scheme for styling
- Role-based routing with `ProtectedRoute` component
- Responsive design with Tailwind CSS
- Modal components for dialogs
- Loading states with `PageLoader` component

### State Management
- Local state for UI interactions (date selection, expand/collapse)
- TanStack Query cache for API data
- Automatic cache invalidation on mutations

## Future Enhancements (Optional)
- Bulk attendance marking for multiple dates
- Attendance notifications for students
- Attendance trends/charts over time
- Email alerts for chronic absences
- Mobile-optimized attendance view for teachers
- Barcode/QR code check-in for students
