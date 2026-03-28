export interface GradeEntry {
  id: string
  student_id: string
  course_id: string
  quiz_id: string | null
  category: string
  label: string | null
  grade: number // 1-5 Kosovo system
  weight: number // e.g. 0.30 = 30%
  posted_at: string | null
  created_at: string
}

export interface GradeBookRow {
  student_id: string
  student_name: string
  email: string
  grades: GradeEntry[]
  weighted_average: number // 1.0 - 5.0
  final_grade: number | null // rounded 1-5
}

export interface GradeBookRead {
  course_id: string
  course_title: string
  rows: GradeBookRow[]
}

export interface StudentGradeSummary {
  course_id: string
  course_title: string
  weighted_average: number // 1.0 - 5.0
  final_grade: number | null // rounded 1-5
  entries: GradeEntry[]
}
