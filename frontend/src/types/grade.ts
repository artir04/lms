export interface GradeEntry {
  id: string
  student_id: string
  course_id: string
  quiz_id: string | null
  category: string
  raw_score: number
  max_score: number
  percentage: number
  letter_grade: string | null
  posted_at: string | null
  created_at: string
}

export interface GradeBookRow {
  student_id: string
  student_name: string
  email: string
  grades: GradeEntry[]
  course_average: number
  letter_grade: string | null
}

export interface GradeBookRead {
  course_id: string
  course_title: string
  rows: GradeBookRow[]
}

export interface StudentGradeSummary {
  course_id: string
  course_title: string
  average: number
  letter_grade: string | null
  entries: GradeEntry[]
}
