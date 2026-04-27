import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/config/axios'
import type {
  Quiz,
  Submission,
  SubmissionListItem,
  ManualGradeItem,
} from '@/types/assessment'

export const assessmentKeys = {
  quizzes: (courseId: string) => ['quizzes', courseId] as const,
  quiz: (quizId: string) => ['quiz', quizId] as const,
  submissions: (quizId: string) => ['submissions', quizId] as const,
  submission: (id: string) => ['submission', id] as const,
}

export function useQuizzes(courseId: string) {
  return useQuery<Quiz[]>({
    queryKey: assessmentKeys.quizzes(courseId),
    queryFn: () => api.get(`/assessments/courses/${courseId}/quizzes`).then((r) => r.data),
    enabled: !!courseId,
  })
}

export function useQuiz(quizId: string) {
  return useQuery<Quiz>({
    queryKey: assessmentKeys.quiz(quizId),
    queryFn: () => api.get(`/assessments/quizzes/${quizId}`).then((r) => r.data),
    enabled: !!quizId,
  })
}

export function useCreateQuiz(courseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Quiz>) => api.post<Quiz>(`/assessments/courses/${courseId}/quizzes`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: assessmentKeys.quizzes(courseId) }),
  })
}

export function useSubmitQuiz(quizId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (answers: { question_id: string; selected_option_id?: string; text_response?: string }[]) =>
      api.post<Submission>(`/assessments/quizzes/${quizId}/submissions`, { answers }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: assessmentKeys.quiz(quizId) }),
  })
}

export function useSubmissions(quizId: string) {
  return useQuery<SubmissionListItem[]>({
    queryKey: assessmentKeys.submissions(quizId),
    queryFn: () => api.get(`/assessments/quizzes/${quizId}/submissions`).then((r) => r.data),
    enabled: !!quizId,
  })
}

export function useSubmission(submissionId: string) {
  return useQuery<Submission>({
    queryKey: assessmentKeys.submission(submissionId),
    queryFn: () => api.get(`/assessments/submissions/${submissionId}`).then((r) => r.data),
    enabled: !!submissionId,
  })
}

export function useManualGrade(submissionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (items: ManualGradeItem[]) =>
      api.patch<Submission>(`/assessments/submissions/${submissionId}/grade`, items).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(assessmentKeys.submission(submissionId), data)
      qc.invalidateQueries({ queryKey: assessmentKeys.submissions(data.quiz_id) })
    },
  })
}
