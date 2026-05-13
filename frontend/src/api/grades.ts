import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/config/axios'
import type { GradeBookRead, StudentGradeSummary, GradeEntry } from '@/types/grade'

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

export function useCreateEntry(courseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      student_id: string
      category: string
      label?: string
      grade: number
      weight?: number
      feedback?: string
    }) => api.post<GradeEntry>(`/gradebook/courses/${courseId}/entries`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gradebook', courseId] })
      qc.invalidateQueries({ queryKey: ['my-grades'] })
    },
  })
}

export function useUpdateEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ entryId, data }: {
      entryId: string
      data: { grade?: number; category?: string; label?: string; weight?: number; feedback?: string }
    }) => api.patch<GradeEntry>(`/gradebook/entries/${entryId}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gradebook'] })
      qc.invalidateQueries({ queryKey: ['my-grades'] })
    },
  })
}
