export interface Notification {
  id: string
  type: string
  payload: Record<string, unknown> | null
  is_read: boolean
  created_at: string
}
