import { useQuery } from '@tanstack/react-query'
import api from '@/config/axios'
import type { DashboardSummary, EngagementReport, GradeDistribution } from '@/types/analytics'

export function useDashboard() {
  return useQuery<DashboardSummary>({
    queryKey: ['analytics', 'dashboard'],
    queryFn: () => api.get('/analytics/dashboard').then((r) => r.data),
  })
}

export function useEngagement(days = 30) {
  return useQuery<EngagementReport>({
    queryKey: ['analytics', 'engagement', days],
    queryFn: () => api.get('/analytics/engagement', { params: { days } }).then((r) => r.data),
  })
}

export function useGradeDistribution(courseId: string) {
  return useQuery<GradeDistribution>({
    queryKey: ['analytics', 'grade-distribution', courseId],
    queryFn: () => api.get(`/analytics/grade-distribution/${courseId}`).then((r) => r.data),
    enabled: !!courseId,
  })
}
