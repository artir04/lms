import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Save, CheckCircle2, AlertCircle } from 'lucide-react'
import { useSubmission, useManualGrade, useQuiz } from '@/api/assessments'
import { PageLoader } from '@/components/ui/Spinner'
import { ROUTES } from '@/config/routes'
import { cn } from '@/utils/cn'
import type { Question } from '@/types/assessment'

interface DraftGrade {
  points_earned: string
  feedback: string
}

export function SubmissionGradingPage() {
  const { submissionId } = useParams<{ submissionId: string }>()
  const { data: submission, isLoading } = useSubmission(submissionId ?? '')
  const { data: quiz } = useQuiz(submission?.quiz_id ?? '')
  const { mutate, isPending, error } = useManualGrade(submissionId ?? '')
  const [drafts, setDrafts] = useState<Record<string, DraftGrade>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!submission) return
    const next: Record<string, DraftGrade> = {}
    for (const ans of submission.answers) {
      next[ans.id] = {
        points_earned: ans.points_earned != null ? String(ans.points_earned) : '',
        feedback: ans.feedback ?? '',
      }
    }
    setDrafts(next)
  }, [submission?.id])

  const questionMap = useMemo(() => {
    const m: Record<string, Question> = {}
    quiz?.questions?.forEach((q) => (m[q.id] = q))
    return m
  }, [quiz])

  if (isLoading || !submission) return <PageLoader />

  const apiError = (error as any)?.response?.data?.detail

  const onSave = () => {
    const items = submission.answers
      .map((ans) => {
        const draft = drafts[ans.id]
        if (!draft || draft.points_earned === '') return null
        const points = Number(draft.points_earned)
        if (Number.isNaN(points)) return null
        return {
          answer_id: ans.id,
          points_earned: points,
          feedback: draft.feedback || null,
        }
      })
      .filter((x): x is { answer_id: string; points_earned: number; feedback: string | null } => !!x)

    if (items.length === 0) return
    mutate(items, {
      onSuccess: () => {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      },
    })
  }

  const courseId = quiz?.course_id ?? ''

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to={courseId ? ROUTES.QUIZ_SUBMISSIONS(courseId, submission.quiz_id) : ROUTES.DASHBOARD}
          className="text-ink-muted hover:text-ink-secondary"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-ink font-display">Grade Submission</h2>
          <p className="text-sm text-ink-muted">
            Attempt #{submission.attempt_num}
            {submission.score != null && ` · current score: ${Number(submission.score).toFixed(1)}%`}
            {' · status: '}
            <span className="capitalize">{submission.status.replace('_', ' ')}</span>
          </p>
        </div>
      </div>

      {apiError && (
        <div className="flex items-start gap-2.5 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{typeof apiError === 'string' ? apiError : 'Save failed.'}</span>
        </div>
      )}

      <div className="space-y-4">
        {submission.answers.map((ans, i) => {
          const q = questionMap[ans.question_id]
          const draft = drafts[ans.id] ?? { points_earned: '', feedback: '' }
          const auto = q && (q.question_type === 'mcq' || q.question_type === 'true_false')
          return (
            <div key={ans.id} className="card p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs uppercase tracking-wider text-ink-muted font-semibold">
                    Question {i + 1}
                    {q && ` · ${q.question_type.replace('_', ' ')} · ${q.points} pts`}
                  </p>
                  <p className="text-sm text-ink mt-1">{q?.text ?? '—'}</p>
                </div>
                {auto && (
                  <span
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0',
                      ans.is_correct
                        ? 'text-emerald-300 bg-emerald-500/15'
                        : 'text-rose-300 bg-rose-500/15'
                    )}
                  >
                    {ans.is_correct ? 'correct' : 'incorrect'}
                  </span>
                )}
              </div>

              <div className="rounded-lg border border-border bg-surface-elevated/50 p-3 mb-3">
                <p className="text-xs text-ink-muted mb-1">Student answer</p>
                {ans.text_response ? (
                  <p className="text-sm text-ink whitespace-pre-wrap">{ans.text_response}</p>
                ) : ans.selected_option_id && q ? (
                  <p className="text-sm text-ink">
                    {q.options.find((o) => o.id === ans.selected_option_id)?.text ?? '—'}
                  </p>
                ) : (
                  <p className="text-sm text-ink-muted italic">No answer provided</p>
                )}
              </div>

              {auto ? (
                <div className="text-xs text-ink-muted">
                  Auto-graded · earned {ans.points_earned ?? 0} / {q?.points ?? 0} pts
                  {ans.feedback && ` · feedback: ${ans.feedback}`}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label">Points</label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      max={q?.points}
                      value={draft.points_earned}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [ans.id]: { ...draft, points_earned: e.target.value },
                        }))
                      }
                      className="input"
                      placeholder={q ? `0 – ${q.points}` : '0'}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Feedback (optional)</label>
                    <input
                      value={draft.feedback}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [ans.id]: { ...draft, feedback: e.target.value },
                        }))
                      }
                      className="input"
                      placeholder="What went well, what to improve…"
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-3 sticky bottom-4">
        <button onClick={onSave} disabled={isPending} className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" /> {isPending ? 'Saving...' : 'Save grades'}
        </button>
        {saved && (
          <span className="text-sm text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Grades saved
          </span>
        )}
      </div>
    </div>
  )
}
