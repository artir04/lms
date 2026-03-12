import { useQuery } from '@tanstack/react-query'
import api from '@/config/axios'
import type { GradeBookRead, StudentGradeSummary } from '@/types/grade'

export function useGradebook(courseId: string) {
  return useQuery<GradeBookRead>({
    queryKey: ['gradebook', courseId],
    queryFn: () => api.get(`/gradebook/courses/${courseId}`).then((r) => r.data),
    enabled: !!courseId,
  })
}

export function useMyGrades() {
  return useQuery<StudentGradeSummary[]>({
    queryKey: ['my-grades'],
    queryFn: () => api.get('/gradebook/me').then((r) => r.data),
  })
}
