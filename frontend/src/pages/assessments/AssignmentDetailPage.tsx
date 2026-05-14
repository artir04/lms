import { useParams, Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { ArrowLeft, Globe } from 'lucide-react'
import { useAssignment } from '@/api/assignments'
import { PageLoader } from '@/components/ui/Spinner'
import { ROUTES } from '@/config/routes'
import { formatDate } from '@/utils/formatters'
import { useAuth } from '@/hooks/useAuth'
import { useForm } from 'react-hook-form'
import api from '@/config/axios'
import { useQueryClient } from '@tanstack/react-query'
import { assignmentKeys } from '@/api/assignments'
import { cn } from '@/utils/cn'

export function AssignmentDetailPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const { data: assignment, isLoading } = useAssignment(assignmentId ?? '')
  const { hasRole } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isTeacher = hasRole('teacher') || hasRole('admin')

  const form = useForm({
    values: {
      title: assignment?.title ?? '',
      description: assignment?.description ?? '',
      due_at: assignment?.due_at ? assignment.due_at.slice(0, 16) : '',
      max_score: String(assignment?.max_score ?? 100),
      is_published: assignment?.is_published ?? false,
      allows_file_upload: assignment?.allows_file_upload ?? false,
      allowed_file_types: assignment?.allowed_file_types ?? '',
    },
  })

  const onSave = form.handleSubmit(async (data) => {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        ...data,
        max_score: Number(data.max_score),
        due_at: data.due_at ? new Date(data.due_at).toISOString() : null,
        allowed_file_types: data.allowed_file_types || null,
      }
      await api.patch(`/assignments/${assignmentId}`, payload)
      qc.invalidateQueries({ queryKey: assignmentKeys.detail(assignmentId!) })
      setEditing(false)
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  })

  if (isLoading) return <PageLoader />
  if (!assignment) return <div className="text-center text-ink-muted py-16">Assignment not found</div>

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to={ROUTES.COURSE_DETAIL(assignment.course_id)}
          className="text-ink-muted hover:text-ink-secondary transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-ink font-display">{assignment.title}</h1>
          <p className="text-sm text-ink-muted">
            {assignment.is_published ? 'Published' : 'Draft'}
            {assignment.due_at && ` · Due ${formatDate(assignment.due_at)}`}
            {' · Max score: '}{assignment.max_score}
          </p>
        </div>
        {isTeacher && !editing && (
          <button onClick={() => setEditing(true)} className="btn-secondary text-sm">
            Edit
          </button>
        )}
        {!isTeacher && (
          <Link
            to={ROUTES.ASSIGNMENT_SUBMIT(assignmentId!)}
            className="btn-primary text-sm"
          >
            {(assignment as any).has_submission ? 'View Submission' : 'Submit'}
          </Link>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm text-rose-400">
          {error}
        </div>
      )}

      {editing ? (
        <form onSubmit={onSave} className="card p-6 space-y-4">
          <div>
            <label className="label">Title *</label>
            <input {...form.register('title', { required: true })} className="input" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea {...form.register('description')} rows={4} className="input resize-none" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Due Date</label>
              <input {...form.register('due_at')} type="datetime-local" className="input" />
            </div>
            <div>
              <label className="label">Max Score</label>
              <input {...form.register('max_score')} type="number" min={1} className="input" />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...form.register('is_published')} className="rounded" />
              <span className="text-sm text-ink-secondary">Published</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...form.register('allows_file_upload')} className="rounded" />
              <span className="text-sm text-ink-secondary">Allow file uploads</span>
            </label>
          </div>
          {form.watch('allows_file_upload') && (
            <div>
              <label className="label">Allowed File Types (comma-separated)</label>
              <input {...form.register('allowed_file_types')} className="input" placeholder="pdf,docx,txt" />
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        <div className="card p-6 space-y-4">
          {assignment.description ? (
            <div>
              <h3 className="text-sm font-medium text-ink-muted mb-1">Description</h3>
              <p className="text-ink-secondary whitespace-pre-wrap">{assignment.description}</p>
            </div>
          ) : (
            <p className="text-ink-muted italic">No description</p>
          )}
          <div className="flex flex-wrap gap-2 text-sm">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                assignment.is_published
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20',
              )}
            >
              <Globe className={cn('h-3.5 w-3.5', !assignment.is_published && 'opacity-60')} />
              {assignment.is_published ? 'Published' : 'Draft'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-elevated text-ink-secondary ring-1 ring-border">
              Max score: <span className="font-semibold text-ink">{assignment.max_score}</span>
            </span>
            {assignment.allows_file_upload && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-elevated text-ink-secondary ring-1 ring-border">
                File upload allowed
                {assignment.allowed_file_types && (
                  <span className="text-ink-muted">({assignment.allowed_file_types})</span>
                )}
              </span>
            )}
          </div>

          {isTeacher && (
            <div className="pt-2">
              <Link
                to={ROUTES.ASSIGNMENT_SUBMISSIONS(assignmentId!)}
                className="btn-primary text-sm"
              >
                View Submissions
                {assignment.submission_count != null && assignment.submission_count > 0 && (
                  <span className="ml-1 opacity-70">({assignment.submission_count})</span>
                )}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
