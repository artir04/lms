import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Target, Users, ToggleLeft, ToggleRight, Zap } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageLoader } from '@/components/ui/Spinner'
import {
  useActivities,
  useCreateActivity,
  useDeleteActivity,
  useUpdateActivity,
} from '@/api/gamification'
import { useCourses } from '@/api/courses'
import { toast } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import type { Activity, ActivityCreate } from '@/types/gamification'

const CATEGORIES = ['general', 'academic', 'attendance', 'engagement', 'wellness', 'community']

export function ActivitiesManagementPage() {
  const { data: activities, isLoading } = useActivities({ includeInactive: true })
  const { data: courses } = useCourses({ page_size: 100 })
  const createMutation = useCreateActivity()
  const updateMutation = useUpdateActivity()
  const deleteMutation = useDeleteActivity()

  const [editing, setEditing] = useState<Activity | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Activity | null>(null)

  const courseLookup = useMemo(() => {
    const m: Record<string, string> = {}
    courses?.items.forEach((c) => { m[c.id] = c.title })
    return m
  }, [courses])

  const handleToggleActive = async (a: Activity) => {
    try {
      await updateMutation.mutateAsync({ id: a.id, body: { is_active: !a.is_active } })
      toast.success(`Activity ${a.is_active ? 'deactivated' : 'activated'}`)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'Update failed')
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await deleteMutation.mutateAsync(deleting.id)
      toast.success('Activity deleted')
      setDeleting(null)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'Delete failed')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-ink font-display">Gamification Activities</h2>
          <p className="text-sm text-ink-muted mt-1">
            Create activities that students can complete to earn points. Self-reported — students mark them complete themselves.
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Activity
        </button>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-elevated/50 border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-medium text-ink-muted uppercase">Activity</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-ink-muted uppercase">Category</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-ink-muted uppercase">Points</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-ink-muted uppercase">Course</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-ink-muted uppercase">Completions</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-ink-muted uppercase">Status</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-ink-muted uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {activities?.map((a) => (
                <tr key={a.id} className="hover:bg-surface-elevated/50">
                  <td className="px-5 py-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <Target className="w-4 h-4 text-primary-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-medium text-ink truncate">{a.title}</p>
                        <p className="text-xs text-ink-muted truncate max-w-md">{a.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-ink-secondary capitalize">{a.category}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1 text-amber-400 font-semibold text-xs">
                      <Zap className="w-3 h-3" /> {a.points}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-ink-secondary text-xs">
                    {a.course_id ? (courseLookup[a.course_id] ?? '—') : <span className="text-ink-muted">All courses</span>}
                  </td>
                  <td className="px-5 py-3 text-ink-secondary text-xs">
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3 h-3" /> {a.completion_count}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {a.is_active ? (
                      <span className="badge badge-green text-[10px]">Active</span>
                    ) : (
                      <span className="badge badge-yellow text-[10px]">Inactive</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleToggleActive(a)}
                        disabled={updateMutation.isPending}
                        className="btn-secondary text-xs px-2 py-1"
                        title={a.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {a.is_active ? (
                          <ToggleRight className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <ToggleLeft className="w-3.5 h-3.5 text-ink-muted" />
                        )}
                      </button>
                      <button
                        onClick={() => setEditing(a)}
                        className="btn-secondary text-xs px-2 py-1"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleting(a)}
                        className="btn-secondary text-xs px-2 py-1 text-rose-400"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {activities && activities.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-ink-muted">
                    No activities yet. Create one to give students something to complete.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={creating} onClose={() => setCreating(false)} title="New Activity" size="lg">
        <ActivityForm
          courses={courses?.items ?? []}
          onCancel={() => setCreating(false)}
          submitting={createMutation.isPending}
          onSubmit={async (body) => {
            try {
              await createMutation.mutateAsync(body)
              toast.success('Activity created')
              setCreating(false)
            } catch (e: any) {
              toast.error(e?.response?.data?.detail ?? 'Create failed')
            }
          }}
        />
      </Modal>

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Edit Activity" size="lg">
        {editing && (
          <ActivityForm
            initial={editing}
            courses={courses?.items ?? []}
            onCancel={() => setEditing(null)}
            submitting={updateMutation.isPending}
            onSubmit={async (body) => {
              try {
                await updateMutation.mutateAsync({ id: editing.id, body })
                toast.success('Activity updated')
                setEditing(null)
              } catch (e: any) {
                toast.error(e?.response?.data?.detail ?? 'Update failed')
              }
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete activity?"
        description={
          deleting
            ? `"${deleting.title}" will be removed. ${deleting.completion_count} completion${deleting.completion_count === 1 ? '' : 's'} will be deleted too. Points already awarded stay with students.`
            : ''
        }
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

interface FormProps {
  initial?: Activity
  courses: { id: string; title: string }[]
  onSubmit: (body: ActivityCreate) => void | Promise<void>
  onCancel: () => void
  submitting?: boolean
}

function ActivityForm({ initial, courses, onSubmit, onCancel, submitting }: FormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [points, setPoints] = useState(initial?.points ?? 10)
  const [category, setCategory] = useState(initial?.category ?? 'general')
  const [courseId, setCourseId] = useState<string>(initial?.course_id ?? '')
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)

  const canSubmit = title.trim().length > 0 && description.trim().length > 0 && points >= 1

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!canSubmit) return
        onSubmit({
          title: title.trim(),
          description: description.trim(),
          points,
          category,
          course_id: courseId || null,
          is_active: isActive,
        })
      }}
      className="space-y-4"
    >
      <div>
        <label className="label">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input"
          placeholder="e.g. Read a chapter from your textbook"
          maxLength={200}
          required
        />
      </div>

      <div>
        <label className="label">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input min-h-[90px]"
          placeholder="What should the student do to complete this?"
          maxLength={2000}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Points reward</label>
          <input
            type="number"
            min={1}
            max={1000}
            value={points}
            onChange={(e) => setPoints(parseInt(e.target.value || '0', 10))}
            className="input"
            required
          />
        </div>
        <div>
          <label className="label">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Course (optional)</label>
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="input">
          <option value="">All courses (open to everyone)</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
        <p className="text-[11px] text-ink-muted mt-1">
          If a course is selected, only students enrolled in it can complete this activity.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="rounded"
        />
        Active (visible to students)
      </label>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className={cn('btn-primary flex-1', (!canSubmit || submitting) && 'opacity-60')}
        >
          {submitting ? 'Saving…' : initial ? 'Save changes' : 'Create activity'}
        </button>
      </div>
    </form>
  )
}
