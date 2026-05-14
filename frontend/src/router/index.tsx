import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/config/routes'
import { LoginPage } from '@/pages/auth/LoginPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { CourseListPage } from '@/pages/courses/CourseListPage'
import { CourseDetailPage } from '@/pages/courses/CourseDetailPage'
import { CourseEditorPage } from '@/pages/courses/CourseEditorPage'
import { LessonPage } from '@/pages/courses/LessonPage'
import { QuizTakePage } from '@/pages/assessments/QuizTakePage'
import { QuizBuilderPage } from '@/pages/assessments/QuizBuilderPage'
import { QuizSubmissionsPage } from '@/pages/assessments/QuizSubmissionsPage'
import { SubmissionGradingPage } from '@/pages/assessments/SubmissionGradingPage'
import { AssignmentDetailPage } from '@/pages/assessments/AssignmentDetailPage'
import { AssignmentSubmitPage } from '@/pages/assessments/AssignmentSubmitPage'
import { AssignmentSubmissionsPage } from '@/pages/assessments/AssignmentSubmissionsPage'
import { AssignmentGradingPage } from '@/pages/assessments/AssignmentGradingPage'
import { MyGradesPage } from '@/pages/grades/MyGradesPage'
import { GradebookPage } from '@/pages/grades/GradebookPage'
import { AnalyticsPage } from '@/pages/analytics/AnalyticsPage'
import { GamificationPage } from '@/pages/gamification/GamificationPage'
import { ActivitiesManagementPage } from '@/pages/admin/ActivitiesManagementPage'
import { UserManagementPage } from '@/pages/admin/UserManagementPage'
import { ReportsPage } from '@/pages/admin/ReportsPage'
import { SettingsPage } from '@/pages/admin/SettingsPage'
import { SchoolsPage } from '@/pages/admin/SchoolsPage'
import { AdminCoursesPage } from '@/pages/admin/AdminCoursesPage'
import { EnrollmentsPage } from '@/pages/admin/EnrollmentsPage'
import { ParentLinkingPage } from '@/pages/admin/ParentLinkingPage'
import { AuditLogPage } from '@/pages/admin/AuditLogPage'
import { NotFoundPage, ForbiddenPage, RouteErrorBoundary } from '@/pages/errors/NotFoundPage'
import { AttendanceMarkingPage } from '@/pages/attendance/AttendanceMarkingPage'
import { AttendanceReportPage } from '@/pages/attendance/AttendanceReportPage'
import { StudentAttendancePage } from '@/pages/attendance/StudentAttendancePage'
import { ParentDashboardPage, ParentChildGradesPage, ParentChildAttendancePage } from '@/pages/parents'
import { TeacherAttendanceOverviewPage } from '@/pages/attendance/TeacherAttendanceOverviewPage'
import { MyStudentsPage } from '@/pages/users/MyStudentsPage'

function DefaultRedirect() {
  const { user, isParent } = useAuth()
  if (!user) return <PageLoader />
  return <Navigate to={isParent ? ROUTES.PARENT : ROUTES.DASHBOARD} replace />
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DefaultRedirect /> },
          // Non-parent roles: dashboard + course browsing
          {
            element: <ProtectedRoute roles={['student', 'teacher', 'admin', 'superadmin']} />,
            children: [
              { path: 'dashboard', element: <DashboardPage /> },
              { path: 'courses', element: <CourseListPage /> },
              { path: 'courses/:courseId', element: <CourseDetailPage /> },
              { path: 'courses/:courseId/lessons/:lessonId', element: <LessonPage /> },
              { path: 'assignments/:assignmentId', element: <AssignmentDetailPage /> },
            ],
          },
          // Student-only routes (own grades / attendance / achievements / quiz taking / assignments)
          {
            element: <ProtectedRoute roles={['student']} />,
            children: [
              { path: 'quizzes/:quizId/take', element: <QuizTakePage /> },
              { path: 'assignments/:assignmentId/submit', element: <AssignmentSubmitPage /> },
              { path: 'grades', element: <MyGradesPage /> },
              { path: 'attendance', element: <StudentAttendancePage /> },
              { path: 'gamification', element: <GamificationPage /> },
            ],
          },
          // Parent routes
          {
            element: <ProtectedRoute roles={['parent']} />,
            children: [
              { path: 'parent', element: <ParentDashboardPage /> },
              { path: 'parent/children/:studentId/grades', element: <ParentChildGradesPage /> },
              { path: 'parent/children/:studentId/attendance', element: <ParentChildAttendancePage /> },
            ],
          },
          // Teacher & Admin only routes
          {
            element: <ProtectedRoute roles={['teacher', 'admin', 'superadmin']} />,
            children: [
              { path: 'courses/:courseId/edit', element: <CourseEditorPage /> },
              { path: 'courses/:courseId/gradebook', element: <GradebookPage /> },
              { path: 'courses/:courseId/quizzes/:quizId/build', element: <QuizBuilderPage /> },
              { path: 'courses/:courseId/quizzes/:quizId/submissions', element: <QuizSubmissionsPage /> },
              { path: 'submissions/:submissionId', element: <SubmissionGradingPage /> },
              { path: 'assignments/:assignmentId/submissions', element: <AssignmentSubmissionsPage /> },
              { path: 'assignments/submissions/:submissionId', element: <AssignmentGradingPage /> },
              { path: 'courses/:courseId/attendance', element: <AttendanceMarkingPage /> },
              { path: 'courses/:courseId/attendance/report', element: <AttendanceReportPage /> },
              { path: 'teacher/attendance', element: <TeacherAttendanceOverviewPage /> },
              { path: 'teacher/students', element: <MyStudentsPage /> },
              { path: 'teacher/activities', element: <ActivitiesManagementPage /> },
              { path: 'analytics', element: <AnalyticsPage /> },
            ],
          },
          // Admin only routes
          {
            element: <ProtectedRoute roles={['admin', 'superadmin']} />,
            children: [
              { path: 'admin/users', element: <UserManagementPage /> },
              { path: 'admin/reports', element: <ReportsPage /> },
              { path: 'admin/settings', element: <SettingsPage /> },
              { path: 'admin/schools', element: <SchoolsPage /> },
              { path: 'admin/courses', element: <AdminCoursesPage /> },
              { path: 'admin/enrollments', element: <EnrollmentsPage /> },
              { path: 'admin/parent-links', element: <ParentLinkingPage /> },
              { path: 'admin/audit', element: <AuditLogPage /> },
            ],
          },
          { path: '403', element: <ForbiddenPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
