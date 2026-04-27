import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/config/axios'
import type { Course, Section } from '@/types/course'
import type { PaginatedResponse } from '@/types/common'

export const courseKeys = {
  all: ['courses'] as const,
  list: (params?: object) => [...courseKeys.all, 'list', params] as const,
  detail: (id: string) => [...courseKeys.all, id] as const,
  sections: (courseId: string) => [...courseKeys.detail(courseId), 'sections'] as const,
}

export function useCourses(params?: {
  page?: number
  page_size?: number
  search?: string
  teacher_id?: string
}) {
  return useQuery<PaginatedResponse<Course>>({
    queryKey: courseKeys.list(params),
    queryFn: () => api.get('/courses', { params }).then((r) => r.data),
  })
}

export function useCourse(courseId: string) {
  return useQuery<Course>({
    queryKey: courseKeys.detail(courseId),
    queryFn: () => api.get(`/courses/${courseId}`).then((r) => r.data),
    enabled: !!courseId,
  })
}

export function useCreateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Course>) => api.post<Course>('/courses', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: courseKeys.all }),
  })
}

export function useUpdateCourse(courseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Course>) => api.patch<Course>(`/courses/${courseId}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseKeys.detail(courseId) })
      qc.invalidateQueries({ queryKey: courseKeys.all })
    },
  })
}

export function useCourseSections(courseId: string) {
  return useQuery<Section[]>({
    queryKey: courseKeys.sections(courseId),
    queryFn: () => api.get(`/courses/${courseId}/sections`).then((r) => r.data),
    enabled: !!courseId,
  })
}

export function useEnrollStudent(courseId: string, sectionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (studentId: string) =>
      api.post(`/courses/${courseId}/sections/${sectionId}/enroll`, { student_id: studentId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: courseKeys.sections(courseId) }),
  })
}
