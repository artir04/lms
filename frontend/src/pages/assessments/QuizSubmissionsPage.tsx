import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { useSubmissions, useQuiz } from '@/api/assessments'
import { PageLoader } from '@/components/ui/Spinner'
import { ROUTES } from '@/config/routes'
import { formatDate } from '@/utils/formatters'
import { cn } from '@/utils/cn'

const STATUS_BADGE: Record<string, string> = {
  graded: 'text-emerald-300 bg-emerald-500/15',
  submitted: 'text-amber-300 bg-amber-500/15',
  in_progress: 'text-sky-300 bg-sky-500/15',
}

export function QuizSubmissionsPage() {
  const { courseId, quizId } = useParams<{ courseId: string; quizId: string }>()
  const { data: quiz, isLoading: quizLoading } = useQuiz(quizId ?? '')
  const { data: submissions, isLoading: subsLoading } = useSubmissions(quizId ?? '')

  if (quizLoading || subsLoading) return <PageLoader />

  const totalPoints = quiz?.total_points ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to={ROUTES.QUIZ_BUILDER(courseId ?? '', quizId ?? '')}
          className="text-ink-muted hover:text-ink-secondary"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-ink font-display">{quiz?.title ?? 'Quiz'} — Submissions</h2>
          <p className="text-sm text-ink-muted">
            {submissions?.length ?? 0} submission{submissions?.length === 1 ? '' : 's'}
            {totalPoints > 0 && ` · out of ${totalPoints} points`}
          </p>
        </div>
      </div>

      {!submissions || submissions.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-ink-muted text-sm">No submissions yet.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-border">
            {submissions.map((sub) => (
              <Link
                key={sub.id}
                to={ROUTES.SUBMISSION(sub.id)}
                className="flex items-center justify-between px-5 py-4 hover:bg-surface-elevated transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                      sub.needs_review
                        ? 'bg-amber-500/15'
                        : sub.status === 'graded'
                          ? 'bg-emerald-500/15'
                          : 'bg-sky-500/15'
                    )}
                  >
                    {sub.needs_review ? (
                      <AlertCircle className="w-5 h-5 text-amber-400" />
                    ) : sub.status === 'graded' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Clock className="w-5 h-5 text-sky-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{sub.student_name}</p>
                    <p className="text-xs text-ink-muted truncate">{sub.student_email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 ml-4">
                  <div className="text-right">
                    <p className="text-sm tabular-nums text-ink">
                      {sub.score != null ? `${Number(sub.score).toFixed(1)}%` : '—'}
                    </p>
                    {sub.submitted_at && (
                      <p className="text-[11px] text-ink-muted">
                        {formatDate(sub.submitted_at)}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider',
                      STATUS_BADGE[sub.status] ?? 'text-ink-muted bg-ink-faint/40'
                    )}
                  >
                    {sub.status.replace('_', ' ')}
                  </span>
                  {sub.needs_review && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider text-amber-300 bg-amber-500/15">
                      Needs review
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
