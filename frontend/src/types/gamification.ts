export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  category: string
  criteria_type: string
  criteria_value: number
}

export interface UserBadge {
  id: string
  badge: Badge
  earned_at: string
}

export interface PointEntry {
  id: string
  points: number
  reason: string
  resource_id: string | null
  created_at: string
}

export interface StudentPoints {
  total_points: number
  badges: UserBadge[]
  recent_points: PointEntry[]
}

export interface LeaderboardEntry {
  student_id: string
  student_name: string
  avatar_url: string | null
  total_points: number
  badge_count: number
  rank: number
}

export interface UpcomingAssignment {
  quiz_id: string
  quiz_title: string
  course_id: string
  course_title: string
  due_at: string | null
  time_limit_min: number | null
  max_attempts: number
  attempts_used: number
  is_overdue: boolean
}

export interface AdminReport {
  total_students: number
  total_teachers: number
  total_courses: number
  total_parents: number
  active_users_30d: number
  avg_platform_grade: number | null
  avg_attendance_rate: number | null
  courses: CourseReport[]
}

export interface CourseReport {
  course_id: string
  course_title: string
  teacher_name: string
  enrolled_count: number
  avg_grade: number | null
  completion_rate: number | null
  avg_attendance_rate: number | null
}