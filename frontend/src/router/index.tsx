import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
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
import { MyGradesPage } from '@/pages/grades/MyGradesPage'
import { GradebookPage } from '@/pages/grades/GradebookPage'
import { AnalyticsPage } from '@/pages/analytics/AnalyticsPage'
import { GamificationPage } from '@/pages/gamification/GamificationPage'
import { UserManagementPage } from '@/pages/admin/UserManagementPage'
import { ReportsPage } from '@/pages/admin/ReportsPage'
import { SettingsPage } from '@/pages/admin/SettingsPage'
import { NotFoundPage, ForbiddenPage } from '@/pages/errors/NotFoundPage'
import { AttendanceMarkingPage } from '@/pages/attendance/AttendanceMarkingPage'
import { AttendanceReportPage } from '@/pages/attendance/AttendanceReportPage'
import { StudentAttendancePage } from '@/pages/attendance/StudentAttendancePage'
import { ParentDashboardPage, ParentChildGradesPage, ParentChildAttendancePage } from '@/pages/parents'
import { TeacherAttendanceOverviewPage } from '@/pages/attendance/TeacherAttendanceOverviewPage'
import { MyStudentsPage } from '@/pages/users/MyStudentsPage'

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
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          // Routes accessible by all authenticated users
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'courses', element: <CourseListPage /> },
          { path: 'courses/:courseId', element: <CourseDetailPage /> },
          { path: 'courses/:courseId/lessons/:lessonId', element: <LessonPage /> },
          { path: 'quizzes/:quizId/take', element: <QuizTakePage /> },
          { path: 'grades', element: <MyGradesPage /> },
          { path: 'attendance', element: <StudentAttendancePage /> },
          },
          // Admin only routes
          {
            element: <ProtectedRoute roles={['admin', 'superadmin']} />,
            children: [
              { path: 'admin/users', element: <UserManagementPage /> },
          // Teacher & Admin only routes
          {
            element: <ProtectedRoute roles={['teacher', 'admin', 'superadmin']} />,
            children: [
              { path: 'courses/:courseId/edit', element: <CourseEditorPage /> },
              { path: 'courses/:courseId/gradebook', element: <GradebookPage /> },
              { path: 'courses/:courseId/quizzes/:quizId/build', element: <QuizBuilderPage /> },
              { path: 'courses/:courseId/quizzes/:quizId/submissions', element: <QuizSubmissionsPage /> },
              { path: 'submissions/:submissionId', element: <SubmissionGradingPage /> },
              { path: 'courses/:courseId/attendance', element: <AttendanceMarkingPage /> },
              { path: 'courses/:courseId/attendance/report', element: <AttendanceReportPage /> },
              { path: 'teacher/attendance', element: <TeacherAttendanceOverviewPage /> },
              { path: 'teacher/students', element: <MyStudentsPage /> },
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
            ],
          },
