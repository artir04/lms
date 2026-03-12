import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useAuth } from '@/hooks/useAuth'
import { PageLoader } from '@/components/ui/Spinner'
import { ROUTES } from '@/config/routes'

interface ProtectedRouteProps {
  roles?: string[]
}

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuthStore()
  const { user } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  if (roles) {
    // Still loading user info — wait before making access decision
    if (!user) return <PageLoader />

    const hasRole = roles.some((r) => user.roles.includes(r))
    if (!hasRole) return <Navigate to="/403" replace />
  }

  return <Outlet />
}
