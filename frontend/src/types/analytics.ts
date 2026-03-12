export interface DashboardSummary {
  total_students: number
  total_courses: number
  avg_grade: number
  active_users_today: number
  at_risk_count: number
}

export interface EngagementPoint {
  date: string
  logins: number
  lesson_views: number
  submissions: number
}

export interface EngagementReport {
  points: EngagementPoint[]
}

export interface GradeDistributionBucket {
  label: string
  count: number
  percentage: number
}

export interface GradeDistribution {
  course_id: string
  buckets: GradeDistributionBucket[]
  mean: number
  median: number
}
