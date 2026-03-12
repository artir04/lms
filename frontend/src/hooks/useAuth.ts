import { useAuthStore } from '@/store/authStore'
import { useQuery } from '@tanstack/react-query'
import api from '@/config/axios'
import type { User } from '@/types/user'

export function useAuth() {
  const { user, isAuthenticated, accessToken, logout, setUser } = useAuthStore()

  const { data: me } = useQuery<User>({
    queryKey: ['me'],
    queryFn: () => api.get('/users/me').then((r) => r.data),
    enabled: isAuthenticated && !user,
    onSuccess: setUser,
  } as any)

  const currentUser = user || me

  const hasRole = (...roles: string[]) =>
    roles.some((r) => currentUser?.roles.includes(r))

  const isStudent = hasRole('student')
  const isTeacher = hasRole('teacher', 'admin', 'superadmin')
  const isAdmin = hasRole('admin', 'superadmin')
  const isSuperAdmin = hasRole('superadmin')

  return { user: currentUser, isAuthenticated, accessToken, logout, hasRole, isStudent, isTeacher, isAdmin, isSuperAdmin }
}
