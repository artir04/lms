import { useParams, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, Pencil, Plus } from 'lucide-react'
import { useGradebook } from '@/api/grades'
import { Modal } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/Spinner'
import { ROUTES } from '@/config/routes'
import { cn } from '@/utils/cn'
import { useForm } from 'react-hook-form'
import api from '@/config/axios'
import type { GradeEntry } from '@/types/grade'

const GRADE_COLORS: Record<number, string> = {
  5: 'badge-green', 4: 'badge-blue', 3: 'badge-yellow', 2: 'badge-yellow', 1: 'badge-red',
}

const GRADE_BG: Record<number, string> = {
  5: 'text-emerald-400', 4: 'text-sky-400', 3: 'text-amber-400', 2: 'text-orange-400', 1: 'text-rose-400',
}

interface CreateState {
  student_id: string
  category: string
  label: string | null
}

export function GradebookPage() {
  const { courseId } = useParams<{ courseId: string }>()!
  const qc = useQueryClient()
  const { data: gradebook, isLoading } = useGradebook(courseId!)
  const [editingEntry, setEditingEntry] = useState<GradeEntry | null>(null)
  const [creatingEntry, setCreatingEntry] = useState<CreateState | null>(null)

  const { mutate: updateEntry, isPending: isUpdating } = useMutation({
    mutationFn: (data: { grade: number; weight: number; category: string; label: string | null }) =>
      api.patch(`/gradebook/entries/${editingEntry!.id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gradebook', courseId] })
      setEditingEntry(null)
    },
  })

  const { mutate: createEntry, isPending: isCreating } = useMutation({
    mutationFn: (data: { student_id: string; grade: number; weight: number; category: string; label: string | null }) =>
      api.post(`/gradebook/courses/${courseId}/entries`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gradebook', courseId] })
      setCreatingEntry(null)
    },
  })

  const { register, handleSubmit, reset } = useForm<{ grade: string; weight: string; category: string; label: string }>()

  const openEdit = (entry: GradeEntry) => {
    setCreatingEntry(null)
    setEditingEntry(entry)
    reset({
      grade: String(entry.grade),
      weight: String(entry.weight),
      category: entry.category,
      label: entry.label || '',
    })
  }

  const openCreate = (student_id: string, category: string, label: string | null) => {
    setEditingEntry(null)
    setCreatingEntry({ student_id, category, label })
    reset({
      grade: '4',
      weight: '0.30',
      category,
      label: label || '',
    })
  }

  const modalOpen = !!(editingEntry || creatingEntry)
  const isPending = isUpdating || isCreating

  const closeModal = () => {
    setEditingEntry(null)
    setCreatingEntry(null)
  }

  const onSubmit = handleSubmit((d) => {
    if (creatingEntry) {
      createEntry({
        student_id: creatingEntry.student_id,
        grade: Number(d.grade),
        weight: Number(d.weight),
        category: d.category,
        label: d.label || null,
      })
    } else if (editingEntry) {
      updateEntry({
        grade: Number(d.grade),
        weight: Number(d.weight),
        category: d.category,
        label: d.label || null,
      })
    }
  })

  if (isLoading) return <PageLoader />
  if (!gradebook) return <div className="text-center text-ink-muted py-16">Gradebook not found</div>

  // Collect all categories across all students
  const allCategories = Array.from(
    new Set(gradebook.rows.flatMap((r) => r.grades.map((g) => g.label || g.category)))
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
        Grades use the Kosovo 1-5 system. The final grade is a <strong className="text-ink">weighted average</strong> of all entries, rounded to the nearest integer.
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
                {allCategories.map((cat) => (
                  <th key={cat} className="px-4 py-3 text-center text-xs font-medium text-ink-muted uppercase capitalize min-w-[100px]">
                    {cat}
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
                  {allCategories.map((cat) => {
                    const entry = row.grades.find((g) => (g.label || g.category) === cat)
                    return (
                      <td key={cat} className="px-4 py-3 text-center">
                        {entry ? (
                          <button
                            onClick={() => openEdit(entry)}
                            className="inline-flex items-center gap-1 group"
                          >
                            <span className={cn('text-lg font-bold', GRADE_BG[entry.grade] || 'text-ink-muted')}>
                              {entry.grade}
                            </span>
                            <span className="text-[10px] text-ink-faint">×{entry.weight}</span>
                            <Pencil className="h-3 w-3 text-ink-faint opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ) : (
                          <button
                            onClick={() => openCreate(row.student_id, cat, cat)}
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
          <div className="grid grid-cols-2 gap-4">
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
              <label className="label">Weight</label>
              <input {...register('weight', { required: true })} type="number" step="0.05" min="0.05" max="1" className="input" />
              <p className="text-[10px] text-ink-muted mt-1">e.g. 0.30 = 30%</p>
            </div>
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
