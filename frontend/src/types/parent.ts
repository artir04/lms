import type { UserSummary } from './user'

export interface ChildSummary {
  student: UserSummary
  course_count: number
  overall_average: number | null
  attendance_rate: number | null
}

export interface ParentDigest {
  children: ChildSummary[]
}

export interface ChildCourseProgress {
  course_id: string
  course_title: string
  weighted_average: number | null
  final_grade: number | null
  entry_count: number
}

export interface UpcomingItem {
  quiz_id: string
  quiz_title: string
  course_title: string
  due_at: string | null
  is_submitted: boolean
}

export interface ChildAttendanceSummary {
  total_days: number
  present: number
  absent: number
  tardy: number
  attendance_rate: number
}

export interface ChildProgressDetail {
  student: UserSummary
  courses: ChildCourseProgress[]
  upcoming_assignments: UpcomingItem[]
  attendance_summary: ChildAttendanceSummary
}