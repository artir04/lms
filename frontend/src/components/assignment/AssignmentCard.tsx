import { Link } from 'react-router-dom'
import { Clock, FileText, CheckCircle2, Edit3 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatDate } from '@/utils/formatters'
import type { Assignment } from '@/types/assignment'

interface AssignmentCardProps {
  assignment: Assignment
  role: 'teacher' | 'student' | 'admin'
  detailUrl: string
  submitUrl: string
  submissionsUrl: string
}

const STATUS_COLORS: Record<string, string> = {
  submitted: 'text-amber-300 bg-amber-500/15',
  graded: 'text-emerald-300 bg-emerald-500/15',
  in_progress: 'text-sky-300 bg-sky-500/15',
}

export function AssignmentCard({ assignment, role, detailUrl, submitUrl, submissionsUrl }: AssignmentCardProps) {
  const isTeacher = role === 'teacher' || role === 'admin'
  const submissionStatus = (assignment as any).has_submission
    ? (assignment as any).submission_status ?? 'submitted'
    : null

  return (
    <div className={cn('card p-5', !assignment.is_published && 'opacity-70')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-ink truncate">{assignment.title}</h4>
            {!assignment.is_published && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-elevated ring-1 ring-border text-ink-muted uppercase tracking-wider shrink-0">
                Draft
              </span>
            )}
            {submissionStatus && (
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0', STATUS_COLORS[submissionStatus] ?? 'text-ink-muted bg-surface-elevated ring-1 ring-border')}>
                {submissionStatus.replace('_', ' ')}
              </span>
            )}
          </div>
          {assignment.description && (
            <p className="text-sm text-ink-muted line-clamp-2">{assignment.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-ink-muted">
            {assignment.due_at && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Due {formatDate(assignment.due_at)}
              </span>
            )}
            <span>Max score: {assignment.max_score}</span>
            {assignment.allows_file_upload && (
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Files allowed
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isTeacher ? (
            <>
              <Link to={submissionsUrl} className="btn-secondary text-xs h-8">
                Submissions
                {assignment.submission_count != null && assignment.submission_count > 0 && (
                  <span className="ml-1 text-ink-muted">({assignment.submission_count})</span>
                )}
              </Link>
              <Link to={detailUrl} className="btn-secondary text-xs h-8">
                <Edit3 className="h-3 w-3" />
              </Link>
            </>
          ) : (
            <>
              {submissionStatus === 'graded' ? (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Graded
                </span>
              ) : (
                <Link to={submitUrl} className="btn-primary text-xs h-8">
                  {submissionStatus ? 'Resubmit' : 'Submit'}
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
