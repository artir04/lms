import { useQuery } from '@tanstack/react-query'
import api from '@/config/axios'
import type { StudentPoints, LeaderboardEntry, UpcomingAssignment } from '@/types/gamification'

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