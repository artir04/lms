import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/config/axios'
import type {
  StudentPoints,
  LeaderboardEntry,
  UpcomingAssignment,
  Activity,
  ActivityCreate,
  ActivityUpdate,
  PointEntry,
} from '@/types/gamification'

export function useMyPoints() {
  return useQuery<StudentPoints>({
    queryKey: ['my-points'],
    queryFn: () => api.get('/gamification/me').then((r) => r.data),
  })
}

export function useLeaderboard(limit = 20) {
  return useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard', limit],
    queryFn: () => api.get('/gamification/leaderboard', { params: { limit } }).then((r) => r.data),
  })
}

export function useUpcoming() {
  return useQuery<UpcomingAssignment[]>({
    queryKey: ['upcoming'],
    queryFn: () => api.get('/gradebook/upcoming').then((r) => r.data),
  })
}

export function useActivities(opts?: { includeInactive?: boolean; courseId?: string | null }) {
  const params: Record<string, string | boolean> = {}
  if (opts?.includeInactive) params.include_inactive = true
  if (opts?.courseId) params.course_id = opts.courseId
  return useQuery<Activity[]>({
    queryKey: ['gamification-activities', opts?.includeInactive ?? false, opts?.courseId ?? null],
    queryFn: () => api.get('/gamification/activities', { params }).then((r) => r.data),
  })
}

export function useCreateActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ActivityCreate) => api.post<Activity>('/gamification/activities', body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gamification-activities'] })
    },
  })
}

export function useUpdateActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ActivityUpdate }) =>
      api.patch<Activity>(`/gamification/activities/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gamification-activities'] })
    },
  })
}

export function useDeleteActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/gamification/activities/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gamification-activities'] })
    },
  })
}

export function useCompleteActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post<PointEntry>(`/gamification/activities/${id}/complete`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gamification-activities'] })
      qc.invalidateQueries({ queryKey: ['my-points'] })
      qc.invalidateQueries({ queryKey: ['leaderboard'] })
    },
  })
}
