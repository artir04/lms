import { UserSummary } from './user'

export interface Course {
  id: string
  tenant_id: string
  title: string
  description: string | null
  subject: string | null
  grade_level: string | null
  start_date: string | null
  end_date: string | null
  is_published: boolean
  teacher: UserSummary
  created_at: string
}

export interface Section {
  id: string
  course_id: string
  name: string
  capacity: number | null
  enrollment_count: number
}

export interface Enrollment {
  id: string
  section_id: string
  student: UserSummary
  status: string
  enrolled_at: string | null
}
