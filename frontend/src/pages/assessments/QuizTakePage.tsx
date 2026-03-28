import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, Clock, Trophy, AlertCircle, ShieldX } from 'lucide-react'
import { useState } from 'react'
import { useQuiz, useSubmitQuiz } from '@/api/assessments'
import { QuizPlayer } from '@/components/assessment/QuizPlayer'
import { PageLoader } from '@/components/ui/Spinner'
import { formatGrade } from '@/utils/formatters'
import { cn } from '@/utils/cn'
import type { Submission } from '@/types/assessment'

export function QuizTakePage() {
  const { quizId } = useParams<{ quizId: string }>()!
  const navigate = useNavigate()
  const { data: quiz, isLoading } = useQuiz(quizId!)
  const { mutate: submit, isPending } = useSubmitQuiz(quizId!)
  const [result, setResult] = useState<Submission | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  if (isLoading) return <PageLoader />
  if (!quiz) return <div className="text-center text-ink-muted py-16">Quiz not found</div>

  const attemptsExhausted =
    quiz.attempts_used != null && quiz.attempts_used >= quiz.max_attempts

  if (attemptsExhausted) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <ShieldX className="h-16 w-16 text-red-400 mx-auto" />
        <h2 className="text-xl font-bold text-ink font-display">No Attempts Remaining</h2>
        <p className="text-ink-muted">
          You have used all {quiz.max_attempts} attempt{quiz.max_attempts !== 1 ? 's' : ''} for this quiz.
        </p>
        <button onClick={() => navigate(-1)} className="btn-primary">
          Back to Course
        </button>
      </div>
    )
  }

  if (result) {
    const score = result.score !== null && result.score !== undefined ? Number(result.score) : null
    const isPending = result.status === 'submitted'
    const isGraded = result.status === 'graded'
    const correctCount = result.answers?.filter((a) => a.is_correct === true).length ?? 0
    const totalAnswered = result.answers?.length ?? 0

    return (
      <div className="max-w-2xl mx-auto py-8 space-y-6">
        {/* Score card */}
        <div className="card p-8 text-center">
          {isPending ? (
            <>
              <Clock className="h-16 w-16 text-amber-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-ink mb-2 font-display">Submitted for Grading</h2>
              <p className="text-ink-muted">Your essay answers require manual grading. You'll see your score once your teacher reviews them.</p>
            </>
          ) : (
            <>
              <Trophy className={cn('h-16 w-16 mx-auto mb-4', score !== null && score >= 70 ? 'text-emerald-400' : 'text-red-400')} />
              <h2 className="text-2xl font-bold text-ink mb-1 font-display">Quiz Complete!</h2>
              <p className="text-5xl font-bold text-primary-400 mb-2 font-display">{score !== null ? formatGrade(score) : '—'}</p>
              <p className="text-ink-muted">{correctCount} of {totalAnswered} questions correct</p>
            </>
          )}
        </div>

        {/* Per-question breakdown */}
        {isGraded && result.answers && result.answers.length > 0 && (
          <div className="card divide-y divide-border/60">
            <div className="px-6 py-3 bg-surface-elevated/50 rounded-t-xl">
              <h3 className="text-sm font-semibold text-ink-secondary font-display">Answer Review</h3>
            </div>
            {result.answers.map((answer, i) => {
              const question = quiz.questions?.find((q) => q.id === answer.question_id)
              return (
                <div key={answer.id} className="px-6 py-4 flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0">
                    {answer.is_correct === true && <CheckCircle className="h-5 w-5 text-emerald-400" />}
                    {answer.is_correct === false && <XCircle className="h-5 w-5 text-red-400" />}
                    {answer.is_correct === null && <AlertCircle className="h-5 w-5 text-ink-muted" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink mb-1">
                      Q{i + 1}. {question?.text ?? 'Question'}
                    </p>
                    {answer.text_response && (
                      <p className="text-sm text-ink-secondary italic">"{answer.text_response}"</p>
                    )}
                    {answer.feedback && (
                      <p className="text-sm text-sky-400 mt-1">{answer.feedback}</p>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-right flex-shrink-0 text-ink-secondary">
                    {answer.points_earned !== null && answer.points_earned !== undefined
                      ? `${Number(answer.points_earned)}/${Number(question?.points ?? 0)} pts`
                      : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <button onClick={() => navigate(-1)} className="btn-primary w-full">
          Back to Course
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink font-display">{quiz.title}</h1>
        {quiz.instructions && <p className="mt-1 text-ink-muted">{quiz.instructions}</p>}
      </div>
      {submitError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
          {submitError}
        </div>
      )}
      <QuizPlayer
        quiz={quiz}
        onSubmit={(answers) =>
          submit(answers, {
            onSuccess: setResult,
            onError: (err: any) => {
              const message = err?.response?.data?.detail || 'Failed to submit quiz. Please try again.'
              setSubmitError(message)
            },
          })
        }
        isSubmitting={isPending}
      />
    </div>
  )
}
