export interface Assignment {
  id: string
  course_id: string
  title: string
  description: string | null
  due_at: string | null
  max_score: number
  is_published: boolean
  allows_file_upload: boolean
  allowed_file_types: string | null
  created_at: string
  submission_count?: number
  has_submission?: boolean
}

export interface AssignmentSubmission {
  id: string
  assignment_id: string
  student_id: string
  text_response: string | null
  file_urls: Record<string, unknown> | null
  submitted_at: string | null
  score: number | null
  status: 'in_progress' | 'submitted' | 'graded'
  feedback: string | null
  created_at: string
}

export interface AssignmentSubmissionListItem {
  id: string
  assignment_id: string
  student_id: string
  student_name: string
  student_email: string
  submitted_at: string | null
  score: number | null
  status: 'in_progress' | 'submitted' | 'graded'
}
