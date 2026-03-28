import { useQuery } from '@tanstack/react-query'
import api from '@/config/axios'
import type { AdminReport } from '@/types/gamification'

export function useAdminReport() {
  return useQuery<AdminReport>({
    queryKey: ['admin-report'],
    queryFn: () => api.get('/analytics/reports').then((r) => r.data),
  })
}