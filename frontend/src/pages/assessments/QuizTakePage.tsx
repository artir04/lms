import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, Trophy, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { useQuiz, useSubmitQuiz, useSubmission } from '@/api/assessments'
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

  const attemptsExhausted =
    !!quiz && quiz.attempts_used != null && quiz.attempts_used >= quiz.max_attempts

  // When the student revisits a quiz they've already taken, load their last
  // submission so they can see their score + per-question review.
  const { data: lastSubmission, isLoading: loadingLast } = useSubmission(
    !result && attemptsExhausted && quiz?.last_submission_id ? quiz.last_submission_id : '',
  )

  if (isLoading) return <PageLoader />
  if (!quiz) return <div className="text-center text-ink-muted py-16">Quiz not found</div>

  if (attemptsExhausted && !result) {
    if (loadingLast) return <PageLoader />
    if (lastSubmission) {
      return <QuizResultView quiz={quiz} result={lastSubmission} onBack={() => navigate(-1)} />
    }
    // Edge case: max_attempts hit but no submission record. Fall through to a small notice.
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <AlertCircle className="h-16 w-16 text-amber-400 mx-auto" />
        <h2 className="text-xl font-bold text-ink font-display">Quiz already submitted</h2>
        <p className="text-ink-muted">
          We couldn't load the submission details. Your grade will appear in My Grades once it's posted.
        </p>
        <button onClick={() => navigate(-1)} className="btn-primary">Back to Course</button>
      </div>
    )
  }

  if (result) {
    return <QuizResultView quiz={quiz} result={result} onBack={() => navigate(-1)} />
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

function QuizResultView({
  quiz,
  result,
  onBack,
}: {
  quiz: { title: string; total_points: number; questions?: { id: string; text: string; points: number }[] }
  result: Submission
  onBack: () => void
}) {
  const isAwaitingReview = result.status === 'submitted'
  const isGraded = result.status === 'graded'

  const earnedPoints = result.answers?.reduce(
    (sum, a) => sum + (a.points_earned != null ? Number(a.points_earned) : 0),
    0,
  ) ?? 0
  const totalPoints = Number(quiz.total_points ?? 0)
  const scorePct = result.score != null ? Number(result.score) : null
  const correctCount = result.answers?.filter((a) => a.is_correct === true).length ?? 0
  const totalAnswered = result.answers?.length ?? 0

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      {/* Score card */}
      <div className="card p-8 text-center">
        {isAwaitingReview ? (
          <>
            <CheckCircle className="h-16 w-16 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-ink mb-2 font-display">Submitted — awaiting review</h2>
            <p className="text-ink-muted mb-5">
              Some questions need teacher review. Your final grade will appear once they're marked.
            </p>
            {result.answers && result.answers.some((a) => a.points_earned != null) && (
              <p className="text-sm text-ink-secondary">
                Auto-graded so far: <span className="font-semibold text-ink">{earnedPoints}</span> /{' '}
                <span className="font-semibold text-ink">{totalPoints}</span> pts
              </p>
            )}
          </>
        ) : (
          <>
            <Trophy className={cn('h-16 w-16 mx-auto mb-4', scorePct !== null && scorePct >= 70 ? 'text-emerald-400' : 'text-amber-400')} />
            <h2 className="text-2xl font-bold text-ink mb-2 font-display">Quiz complete</h2>
            <p className="text-5xl font-bold text-primary-400 font-display leading-none">
              {earnedPoints}
              <span className="text-3xl text-ink-secondary"> / {totalPoints}</span>
            </p>
            <p className="text-sm text-ink-muted mt-2">points earned</p>
            <div className="flex items-center justify-center gap-6 mt-5 pt-5 border-t border-border/60 text-sm">
              <span className="text-ink-secondary">
                Score: <span className="font-semibold text-ink">{scorePct !== null ? formatGrade(scorePct) : '—'}</span>
              </span>
              <span className="text-ink-secondary">
                Correct: <span className="font-semibold text-ink">{correctCount}/{totalAnswered}</span>
              </span>
            </div>
          </>
        )}
      </div>

      {/* Per-question breakdown */}
      {(isGraded || isAwaitingReview) && result.answers && result.answers.length > 0 && (
        <div className="card divide-y divide-border/60">
          <div className="px-6 py-3 bg-surface-elevated/50 rounded-t-xl">
            <h3 className="text-sm font-semibold text-ink-secondary font-display">Answer review</h3>
          </div>
          {result.answers.map((answer, i) => {
            const question = quiz.questions?.find((q) => q.id === answer.question_id)
            const awaitingThis = answer.points_earned == null
            return (
              <div key={answer.id} className="px-6 py-4 flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  {answer.is_correct === true && <CheckCircle className="h-5 w-5 text-emerald-400" />}
                  {answer.is_correct === false && <XCircle className="h-5 w-5 text-red-400" />}
                  {answer.is_correct == null && <AlertCircle className="h-5 w-5 text-ink-muted" />}
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
                <div className="text-sm font-semibold text-right flex-shrink-0">
                  {awaitingThis ? (
                    <span className="text-xs text-amber-400 italic">Awaiting review</span>
                  ) : (
                    <span className="text-ink-secondary">
                      {Number(answer.points_earned)}/{Number(question?.points ?? 0)} pts
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button onClick={onBack} className="btn-primary w-full">
        Back to Course
      </button>
    </div>
  )
}
