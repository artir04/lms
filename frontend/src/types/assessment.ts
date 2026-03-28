export interface QuestionOption {
  id: string
  text: string
  is_correct?: boolean | null
}

export interface Question {
  id: string
  text: string
  question_type: 'mcq' | 'true_false' | 'short_answer' | 'essay'
  points: number
  position: number
  explanation: string | null
  options: QuestionOption[]
}

export interface Quiz {
  id: string
  course_id: string
  title: string
  instructions: string | null
  time_limit_min: number | null
  max_attempts: number
  due_at: string | null
  is_published: boolean
  question_count: number
  total_points: number
  created_at: string
  questions?: Question[]
  attempts_used?: number | null
}

export interface Answer {
  id: string
  question_id: string
  selected_option_id: string | null
  text_response: string | null
  is_correct: boolean | null
  points_earned: number | null
  feedback: string | null
}

export interface Submission {
  id: string
  quiz_id: string
  student_id: string
  attempt_num: number
  started_at: string
  submitted_at: string | null
  score: number | null
  status: 'in_progress' | 'submitted' | 'graded'
  answers: Answer[]
}
