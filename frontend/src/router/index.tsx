import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { LoginPage } from '@/pages/auth/LoginPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { CourseListPage } from '@/pages/courses/CourseListPage'
import { CourseDetailPage } from '@/pages/courses/CourseDetailPage'
import { CourseEditorPage } from '@/pages/courses/CourseEditorPage'
import { LessonPage } from '@/pages/courses/LessonPage'
import { QuizTakePage } from '@/pages/assessments/QuizTakePage'
import { QuizBuilderPage } from '@/pages/assessments/QuizBuilderPage'
import { MyGradesPage } from '@/pages/grades/MyGradesPage'
import { GradebookPage } from '@/pages/grades/GradebookPage'
import { MessagingPage } from '@/pages/messaging/MessagingPage'
import { AnalyticsPage } from '@/pages/analytics/AnalyticsPage'
import { UserManagementPage } from '@/pages/admin/UserManagementPage'
import { NotFoundPage, ForbiddenPage } from '@/pages/errors/NotFoundPage'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'courses', element: <CourseListPage /> },
          { path: 'courses/:courseId', element: <CourseDetailPage /> },
          { path: 'courses/:courseId/edit', element: <CourseEditorPage /> },
          { path: 'courses/:courseId/lessons/:lessonId', element: <LessonPage /> },
          { path: 'courses/:courseId/gradebook', element: <GradebookPage /> },
          { path: 'courses/:courseId/quizzes/:quizId/build', element: <QuizBuilderPage /> },
          { path: 'quizzes/:quizId/take', element: <QuizTakePage /> },
          { path: 'grades', element: <MyGradesPage /> },
          { path: 'messaging', element: <MessagingPage /> },
          { path: 'analytics', element: <AnalyticsPage /> },
          { path: 'admin/users', element: <UserManagementPage /> },
          { path: 'admin/settings', element: <div className="text-center py-16 text-gray-400">Settings coming soon</div> },
        ],
      },
    ],
  },
  { path: '/403', element: <ForbiddenPage /> },
  { path: '*', element: <NotFoundPage /> },
])
