import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/config/axios'
import type { Notification } from '@/types/notification'
import { useNotificationStore } from '@/store/notificationStore'
import { useEffect } from 'react'

interface NotificationPage {
  items: Notification[]
  total: number
  page: number
  page_size: number
}

export function useNotifications(page = 1, pageSize = 10) {
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount)

  const query = useQuery<NotificationPage>({
    queryKey: ['notifications', page, pageSize],
    queryFn: () =>
      api.get('/notifications', { params: { page, page_size: pageSize } }).then((r) => r.data),
  })

  useEffect(() => {
    if (query.data) {
      const unread = query.data.items.filter((n) => !n.is_read).length
      setUnreadCount(unread)
    }
  }, [query.data, setUnreadCount])

  return query
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) =>
      api.post('/notifications/read', { notification_ids: ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}
