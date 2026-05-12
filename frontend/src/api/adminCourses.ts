import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/config/axios'
import type { PaginatedResponse } from '@/types/common'

export interface AdminCourseRow {
  id: string
  title: string
  subject: string | null
  grade_level: string | null
  teacher_id: string
  teacher_name: string
  teacher_email: string
  is_published: boolean
  is_archived: boolean
  section_count: number
  enrollment_count: number
  school_id: string | null
  created_at: string
}

export interface AdminCourseParams {
  page?: number
  page_size?: number
  search?: string
  teacher_id?: string
  school_id?: string
  status?: 'active' | 'published' | 'draft' | 'archived'
}

export const adminCourseKeys = {
  all: ['admin-courses'] as const,
  list: (p: AdminCourseParams) => [...adminCourseKeys.all, 'list', p] as const,
}

export function useAdminCourses(params: AdminCourseParams) {
  return useQuery<PaginatedResponse<AdminCourseRow>>({
    queryKey: adminCourseKeys.list(params),
    queryFn: () => api.get('/courses/admin', { params }).then((r) => r.data),
  })
}

export function useArchiveCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (courseId: string) =>
      api.post(`/courses/${courseId}/archive`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminCourseKeys.all }),
  })
}

export function useUnarchiveCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (courseId: string) =>
      api.post(`/courses/${courseId}/unarchive`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminCourseKeys.all }),
  })
}

export function useReassignTeacher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ courseId, teacherId }: { courseId: string; teacherId: string }) =>
      api
        .post(`/courses/${courseId}/reassign-teacher`, { teacher_id: teacherId })
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminCourseKeys.all }),
  })
}
