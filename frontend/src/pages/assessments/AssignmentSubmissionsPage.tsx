import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { useAssignment, useAssignmentSubmissions } from '@/api/assignments'
import { PageLoader } from '@/components/ui/Spinner'
import { ROUTES } from '@/config/routes'
import { formatDate } from '@/utils/formatters'
import { cn } from '@/utils/cn'

const STATUS_BADGE: Record<string, string> = {
  graded: 'text-emerald-300 bg-emerald-500/15',
  submitted: 'text-amber-300 bg-amber-500/15',
  in_progress: 'text-sky-300 bg-sky-500/15',
}

const STATUS_ICON: Record<string, typeof CheckCircle2> = {
  graded: CheckCircle2,
  submitted: Clock,
  in_progress: AlertCircle,
}

export function AssignmentSubmissionsPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const { data: assignment, isLoading: assignmentLoading } = useAssignment(assignmentId ?? '')
  const { data: submissions, isLoading: subsLoading } = useAssignmentSubmissions(assignmentId ?? '')

  if (assignmentLoading || subsLoading) return <PageLoader />

  const maxScore = assignment?.max_score ?? 100

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to={ROUTES.ASSIGNMENT_DETAIL(assignmentId ?? '')}
          className="text-ink-muted hover:text-ink-secondary"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-ink font-display">
            {assignment?.title ?? 'Assignment'} — Submissions
          </h2>
          <p className="text-sm text-ink-muted">
            {submissions?.length ?? 0} submission{submissions?.length === 1 ? '' : 's'}
            {' · '}out of {maxScore} max score
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
            {submissions.map((sub) => {
              const Icon = STATUS_ICON[sub.status] ?? AlertCircle
              return (
                <Link
                  key={sub.id}
                  to={ROUTES.ASSIGNMENT_SUBMISSION_GRADE(sub.id)}
                  className="flex items-center justify-between px-5 py-4 hover:bg-surface-elevated transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                        sub.status === 'graded'
                          ? 'bg-emerald-500/15'
                          : sub.status === 'submitted'
                            ? 'bg-amber-500/15'
                            : 'bg-sky-500/15',
                      )}
                    >
                      <Icon
                        className={cn(
                          'w-5 h-5',
                          sub.status === 'graded'
                            ? 'text-emerald-400'
                            : sub.status === 'submitted'
                              ? 'text-amber-400'
                              : 'text-sky-400',
                        )}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{sub.student_name}</p>
                      <p className="text-xs text-ink-muted truncate">{sub.student_email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    <div className="text-right">
                      <p className="text-sm tabular-nums text-ink">
                        {sub.score != null ? `${Number(sub.score).toFixed(1)} / ${maxScore}` : '—'}
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
                        STATUS_BADGE[sub.status] ?? 'text-ink-muted bg-ink-faint/40',
                      )}
                    >
                      {sub.status.replace('_', ' ')}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
