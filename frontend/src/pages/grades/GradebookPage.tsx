import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { ArrowLeft, Pencil, Plus, AlertCircle } from 'lucide-react'
import { useGradebook, useCreateEntry, useUpdateEntry } from '@/api/grades'
import { Modal } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/Spinner'
import { ROUTES } from '@/config/routes'
import { cn } from '@/utils/cn'
import { useForm } from 'react-hook-form'
import type { GradeEntry } from '@/types/grade'

const GRADE_COLORS: Record<number, string> = {
  5: 'badge-green', 4: 'badge-blue', 3: 'badge-yellow', 2: 'badge-yellow', 1: 'badge-red',
}

const GRADE_BG: Record<number, string> = {
  5: 'text-emerald-400', 4: 'text-sky-400', 3: 'text-amber-400', 2: 'text-orange-400', 1: 'text-rose-400',
}

interface ColumnDef {
  label: string
  category: string
  weight: number | null
}

interface CreateState {
  student_id: string
  category: string
  label?: string
}

export function GradebookPage() {
  const { courseId } = useParams<{ courseId: string }>()!
  const { data: gradebook, isLoading } = useGradebook(courseId!)
  const [editingEntry, setEditingEntry] = useState<GradeEntry | null>(null)
  const [creatingEntry, setCreatingEntry] = useState<CreateState | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { mutate: createEntry, isPending: isCreating } = useCreateEntry(courseId!)
  const { mutate: updateEntry, isPending: isUpdating } = useUpdateEntry()

  // Wire up error handling for the mutations
  const wrappedCreate = (data: { student_id: string; grade: number; category: string; label?: string; feedback?: string }) => {
    createEntry(data, {
      onSuccess: () => { setCreatingEntry(null); setError(null) },
      onError: (err: any) => { setError(err?.response?.data?.detail || err?.message || 'Failed to add grade') },
    })
  }

  const wrappedUpdate = (data: { entryId: string; data: { grade?: number; category?: string; label?: string; feedback?: string } }) => {
    updateEntry(data, {
      onSuccess: () => { setEditingEntry(null); setError(null) },
      onError: (err: any) => { setError(err?.response?.data?.detail || err?.message || 'Failed to update grade') },
    })
  }

  const { register, handleSubmit, reset } = useForm<{ grade: string; category: string; label: string; feedback: string }>()

  const openEdit = (entry: GradeEntry) => {
    setCreatingEntry(null)
    setError(null)
    setEditingEntry(entry)
    reset({
      grade: String(entry.grade),
      category: entry.category,
      label: entry.label || '',
      feedback: entry.feedback || '',
    })
  }

  const openCreate = (student_id: string, category: string, label: string) => {
    setEditingEntry(null)
    setError(null)
    setCreatingEntry({ student_id, category, label })
    reset({
      grade: '4',
      category,
      label,
      feedback: '',
    })
  }

  const modalOpen = !!(editingEntry || creatingEntry)
  const isPending = isCreating || isUpdating

  const closeModal = () => {
    setEditingEntry(null)
    setCreatingEntry(null)
    setError(null)
  }

  const onSubmit = handleSubmit((d) => {
    setError(null)
    if (creatingEntry) {
      wrappedCreate({
        student_id: creatingEntry.student_id,
        grade: Number(d.grade),
        category: d.category,
        label: d.label || undefined,
        feedback: d.feedback || undefined,
      })
    } else if (editingEntry) {
      wrappedUpdate({
        entryId: editingEntry.id,
        data: {
          grade: Number(d.grade),
          category: d.category,
          label: d.label || undefined,
          feedback: d.feedback || undefined,
        },
      })
    }
  })

  if (isLoading) return <PageLoader />
  if (!gradebook) return <div className="text-center text-ink-muted py-16">Gradebook not found</div>

  // Build column definitions: each column knows its display label, underlying category, and weight
  const allColumns: ColumnDef[] = Array.from(
    new Map(
      gradebook.rows.flatMap((r) =>
        r.grades.map((g) => [
          g.label || g.category,
          { label: g.label || g.category, category: g.category, weight: Number(g.weight) },
        ])
      )
    ).values()
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to={ROUTES.COURSE_DETAIL(courseId!)} className="text-ink-muted hover:text-ink-secondary transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-ink font-display">Gradebook</h1>
          <p className="text-sm text-ink-muted">{gradebook.course_title}</p>
        </div>
      </div>

      <div className="card p-4 text-sm text-ink-secondary">
        Grades use the Kosovo 1-5 system. Weights are auto-computed from the course category configuration. Set category weights in Course Settings.
      </div>

      {!gradebook.rows.length ? (
        <div className="card p-12 text-center text-ink-muted">No students enrolled yet.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-elevated/50 border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-ink-muted uppercase sticky left-0 bg-surface-elevated/50 min-w-[180px]">
                  Student
                </th>
                {allColumns.map((col) => (
                  <th key={col.label} className="px-4 py-3 text-center min-w-[100px]">
                    <div className="text-xs font-medium text-ink-muted uppercase capitalize">{col.label}</div>
                    {col.weight != null && (
                      <span className="text-[10px] text-ink-faint mt-0.5">
                        {Math.round(col.weight * 100)}%
                      </span>
                    )}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium text-ink-muted uppercase min-w-[100px]">
                  Average
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-ink-muted uppercase min-w-[80px]">
                  Final
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {gradebook.rows.map((row) => (
                <tr key={row.student_id} className="hover:bg-surface-elevated/50">
                  <td className="px-4 py-3 sticky left-0 bg-surface">
                    <div>
                      <p className="font-medium text-ink">{row.student_name}</p>
                      <p className="text-xs text-ink-muted">{row.email}</p>
                    </div>
                  </td>
                  {allColumns.map((col) => {
                    const entry = row.grades.find((g) => (g.label || g.category) === col.label)
                    return (
                      <td key={col.label} className="px-4 py-3 text-center">
                        {entry ? (
                          <button
                            onClick={() => openEdit(entry)}
                            className="inline-flex items-center gap-1 group"
                          >
                            <span className={cn('text-lg font-bold', GRADE_BG[entry.grade] || 'text-ink-muted')}>
                              {entry.grade}
                            </span>
                            <Pencil className="h-3 w-3 text-ink-faint opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ) : (
                          <button
                            onClick={() => openCreate(row.student_id, col.category, col.label)}
                            className="inline-flex items-center gap-1 text-ink-faint hover:text-ink-secondary transition-colors group"
                            title="Add grade"
                          >
                            <span className="text-lg">—</span>
                            <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-center font-medium text-ink">
                    {Number(row.weighted_average) > 0 ? Number(row.weighted_average).toFixed(2) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.final_grade != null ? (
                      <span className={cn('badge', GRADE_COLORS[row.final_grade] || 'badge-gray')}>
                        {row.final_grade}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal isOpen={modalOpen} onClose={closeModal} title={creatingEntry ? 'Add Grade' : 'Edit Grade'}>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm text-rose-400">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="label">Label</label>
            <input {...register('label')} className="input" placeholder="e.g. Test 1, Midterm" />
          </div>
          <div>
            <label className="label">Category</label>
            <select {...register('category')} className="input">
              <option value="quiz">Quiz</option>
              <option value="exam">Exam</option>
              <option value="assignment">Assignment</option>
              <option value="participation">Participation</option>
            </select>
          </div>
          <div>
            <label className="label">Grade (1-5)</label>
            <select {...register('grade', { required: true })} className="input">
              <option value="5">5 (Excellent)</option>
              <option value="4">4 (Good)</option>
              <option value="3">3 (Satisfactory)</option>
              <option value="2">2 (Sufficient)</option>
              <option value="1">1 (Insufficient)</option>
            </select>
          </div>
          <div>
            <label className="label">Feedback</label>
            <textarea {...register('feedback')} rows={3} className="input resize-none" placeholder="Optional feedback for the student..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1">
              {isPending ? 'Saving...' : creatingEntry ? 'Add Entry' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
