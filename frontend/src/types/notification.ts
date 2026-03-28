export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  payload: Record<string, any> | null
  is_read: boolean
  created_at: string
}
