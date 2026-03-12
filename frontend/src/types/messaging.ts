export interface Message {
  id: string
  sender_id: string
  body: string
  sent_at: string
}

export interface Thread {
  id: string
  subject: string
  course_id: string | null
  created_by: string
  unread_count: number
  last_message: Message | null
  participants: { id: string; full_name: string; avatar_url: string | null }[]
  created_at: string
  messages?: Message[]
}
