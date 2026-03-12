import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/config/axios'
import type { Thread, Message } from '@/types/messaging'

export function useThreads() {
  return useQuery<Thread[]>({
    queryKey: ['threads'],
    queryFn: () => api.get('/messaging/threads').then((r) => r.data),
  })
}

export function useThread(threadId: string) {
  return useQuery<Thread>({
    queryKey: ['thread', threadId],
    queryFn: () => api.get(`/messaging/threads/${threadId}`).then((r) => r.data),
    enabled: !!threadId,
  })
}

export function useSendMessage(threadId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => api.post(`/messaging/threads/${threadId}/messages`, { body }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['thread', threadId] })
      qc.invalidateQueries({ queryKey: ['threads'] })
    },
  })
}

export function useCreateThread() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { subject: string; recipient_ids: string[]; initial_message: string; course_id?: string }) =>
      api.post('/messaging/threads', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['threads'] }),
  })
}
