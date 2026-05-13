import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/config/axios'
import type { Assignment, AssignmentSubmission, AssignmentSubmissionListItem } from '@/types/assignment'

export const assignmentKeys = {
  all: (courseId: string) => ['assignments', courseId] as const,
  detail: (assignmentId: string) => ['assignment', assignmentId] as const,
  submissions: (assignmentId: string) => ['assignment-submissions', assignmentId] as const,
  submission: (id: string) => ['assignment-submission', id] as const,
}

export function useAssignments(courseId: string) {
  return useQuery<Assignment[]>({
    queryKey: assignmentKeys.all(courseId),
    queryFn: () => api.get(`/assignments/courses/${courseId}`).then((r) => r.data),
    enabled: !!courseId,
  })
}

export function useAssignment(assignmentId: string) {
  return useQuery<Assignment>({
    queryKey: assignmentKeys.detail(assignmentId),
    queryFn: () => api.get(`/assignments/${assignmentId}`).then((r) => r.data),
    enabled: !!assignmentId,
  })
}

export function useCreateAssignment(courseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Assignment>) =>
      api.post<Assignment>(`/assignments/courses/${courseId}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: assignmentKeys.all(courseId) }),
  })
}

export function useSubmitAssignment(assignmentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { text_response?: string; file_urls?: Record<string, unknown> }) =>
      api.post<AssignmentSubmission>(`/assignments/${assignmentId}/submissions`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: assignmentKeys.detail(assignmentId) })
      qc.invalidateQueries({ queryKey: ['upcoming'] })
      qc.invalidateQueries({ queryKey: ['my-grades'] })
    },
  })
}

export function useAssignmentSubmissions(assignmentId: string) {
  return useQuery<AssignmentSubmissionListItem[]>({
    queryKey: assignmentKeys.submissions(assignmentId),
    queryFn: () => api.get(`/assignments/${assignmentId}/submissions`).then((r) => r.data),
    enabled: !!assignmentId,
  })
}

export function useAssignmentSubmission(submissionId: string) {
  return useQuery<AssignmentSubmission>({
    queryKey: assignmentKeys.submission(submissionId),
    queryFn: () => api.get(`/assignments/submissions/${submissionId}`).then((r) => r.data),
    enabled: !!submissionId,
  })
}

export function useGradeAssignment(submissionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { score: number; feedback?: string }) =>
      api.patch<AssignmentSubmission>(`/assignments/submissions/${submissionId}/grade`, data).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(assignmentKeys.submission(submissionId), data)
      qc.invalidateQueries({ queryKey: assignmentKeys.submissions(data.assignment_id) })
    },
  })
}
