import { useState } from 'react'
import { ChevronRight, ChevronLeft, Clock, Send } from 'lucide-react'
import type { Quiz, Question } from '@/types/assessment'
import { cn } from '@/utils/cn'

interface QuizPlayerProps {
  quiz: Quiz
  onSubmit: (answers: { question_id: string; selected_option_id?: string; text_response?: string }[]) => void
  isSubmitting: boolean
}

export function QuizPlayer({ quiz, onSubmit, isSubmitting }: QuizPlayerProps) {
  const questions = quiz.questions || []
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, { selected_option_id?: string; text_response?: string }>>({})

  const currentQuestion = questions[currentIndex]

  const setAnswer = (questionId: string, value: { selected_option_id?: string; text_response?: string }) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const handleSubmit = () => {
    const formatted = questions.map((q) => ({
      question_id: q.id,
      ...(answers[q.id] || {}),
    }))
    onSubmit(formatted)
  }

  if (!currentQuestion) return null

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Progress */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span className="text-sm text-gray-500">{currentQuestion.points} point{currentQuestion.points !== 1 ? 's' : ''}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="card p-6">
        <p className="text-lg font-medium text-gray-900 mb-6">{currentQuestion.text}</p>

        {/* MCQ / True-False Options */}
        {(currentQuestion.question_type === 'mcq' || currentQuestion.question_type === 'true_false') && (
          <div className="space-y-3">
            {currentQuestion.options.map((opt) => {
              const isSelected = answers[currentQuestion.id]?.selected_option_id === opt.id
              return (
                <button
                  key={opt.id}
                  onClick={() => setAnswer(currentQuestion.id, { selected_option_id: opt.id })}
                  className={cn(
                    'w-full text-left px-4 py-3 rounded-lg border-2 transition-all text-sm',
                    isSelected
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  )}
                >
                  {opt.text}
                </button>
              )
            })}
          </div>
        )}

        {/* Short Answer / Essay */}
        {(currentQuestion.question_type === 'short_answer' || currentQuestion.question_type === 'essay') && (
          <textarea
            rows={currentQuestion.question_type === 'essay' ? 8 : 3}
            value={answers[currentQuestion.id]?.text_response || ''}
            onChange={(e) => setAnswer(currentQuestion.id, { text_response: e.target.value })}
            placeholder="Type your answer here..."
            className="input resize-none"
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentIndex((i) => i - 1)}
          disabled={currentIndex === 0}
          className="btn-secondary"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>

        {currentIndex < questions.length - 1 ? (
          <button onClick={() => setCurrentIndex((i) => i + 1)} className="btn-primary">
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={isSubmitting} className="btn-primary">
            <Send className="h-4 w-4" />
            {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
          </button>
        )}
      </div>
    </div>
  )
}
