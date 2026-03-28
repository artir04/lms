import { useQuery } from '@tanstack/react-query'
import api from '@/config/axios'
import type { ParentDigest, ChildProgressDetail } from '@/types/parent'

export function useParentDigest() {
  return useQuery<ParentDigest>({
    queryKey: ['parent-digest'],
    queryFn: () => api.get('/parents/digest').then((r) => r.data),
  })
}

export function useChildProgress(studentId: string | undefined) {
  return useQuery<ChildProgressDetail>({
    queryKey: ['child-progress', studentId],
    queryFn: () => api.get(`/parents/children/${studentId}/progress`).then((r) => r.data),
    enabled: !!studentId,
  })
}