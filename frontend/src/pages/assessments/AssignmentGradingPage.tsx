import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Save, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAssignmentSubmission, useGradeAssignment } from '@/api/assignments'
import { PageLoader } from '@/components/ui/Spinner'
import { ROUTES } from '@/config/routes'
import { formatDate } from '@/utils/formatters'
import { cn } from '@/utils/cn'

export function AssignmentGradingPage() {
  const { submissionId } = useParams<{ submissionId: string }>()
  const { data: submission, isLoading } = useAssignmentSubmission(submissionId ?? '')
  const { mutate: grade, isPending } = useGradeAssignment(submissionId ?? '')

  const [score, setScore] = useState('')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  if (isLoading) return <PageLoader />
  if (!submission) return <div className="text-center text-ink-muted py-16">Submission not found</div>

  const initialized = score === '' && feedback === ''
  if (initialized) {
    if (submission.score != null) setScore(String(submission.score))
    if (submission.feedback) setFeedback(submission.feedback)
  }

  const onSave = () => {
    setError(null)
    const scoreNum = Number(score)
    if (isNaN(scoreNum) || scoreNum < 0) {
      setError('Please enter a valid score')
      return
    }
    grade(
      { score: scoreNum, feedback: feedback || undefined },
      {
        onSuccess: () => {
          setSaved(true)
          setTimeout(() => setSaved(false), 2500)
        },
        onError: (err: any) => setError(err?.response?.data?.detail ?? 'Failed to save grade'),
      },
    )
  }

  const statusColors: Record<string, string> = {
    submitted: 'text-amber-300 bg-amber-500/15',
    graded: 'text-emerald-300 bg-emerald-500/15',
    in_progress: 'text-sky-300 bg-sky-500/15',
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to={ROUTES.ASSIGNMENT_SUBMISSIONS(submission.assignment_id)}
          className="text-ink-muted hover:text-ink-secondary"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-ink font-display">Grade Submission</h2>
          <p className="text-sm text-ink-muted">
            <span className="capitalize">{submission.status.replace('_', ' ')}</span>
            {submission.submitted_at && ` · submitted ${formatDate(submission.submitted_at)}`}
            {submission.score != null && ` · current score: ${Number(submission.score)}`}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Student response */}
      <div className="card p-5 space-y-3">
        <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wider">Student Response</h3>
        {submission.text_response ? (
          <p className="text-ink-secondary whitespace-pre-wrap text-sm">{submission.text_response}</p>
        ) : (
          <p className="text-ink-muted italic text-sm">No text response provided</p>
        )}

        {(() => {
          const raw = submission.file_urls as any
          const files: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.files) ? raw.files : []
          if (files.length === 0) return null
          return (
            <div className="mt-3">
              <p className="text-xs text-ink-muted mb-2">Attachments</p>
              <ul className="space-y-1">
                {files.map((file: any, i: number) => {
                  const label = (
                    <>
                      {file.name ?? `File ${i + 1}`}
                      {file.size && <span className="text-ink-muted ml-1">({(file.size / 1024).toFixed(1)} KB)</span>}
                    </>
                  )
                  return (
                    <li key={i} className="text-sm">
                      {file.url ? (
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 underline"
                        >
                          {label}
                        </a>
                      ) : (
                        <span className="text-ink-secondary">{label}</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })()}
      </div>

      {/* Grading form */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wider">Grade</h3>
        <div>
          <label className="label">Score</label>
          <input
            type="number"
            step="0.1"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="input max-w-[200px]"
            placeholder="0 - 100"
          />
        </div>
        <div>
          <label className="label">Feedback</label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            className="input resize-none"
            placeholder="Provide feedback for the student..."
          />
        </div>
      </div>

      <div className="flex items-center gap-3 sticky bottom-4">
        <button onClick={onSave} disabled={isPending} className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          {isPending ? 'Saving...' : 'Save grade'}
        </button>
        {saved && (
          <span className="text-sm text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Grade saved
          </span>
        )}
      </div>
    </div>
  )
}
