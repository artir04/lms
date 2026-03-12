import { useParams, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, Pencil } from 'lucide-react'
import { useGradebook } from '@/api/grades'
import { Modal } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/Spinner'
import { ROUTES } from '@/config/routes'
import { formatGrade } from '@/utils/formatters'
import { cn } from '@/utils/cn'
import { useForm } from 'react-hook-form'
import api from '@/config/axios'
import type { GradeEntry } from '@/types/grade'

const LETTER_COLORS: Record<string, string> = {
  A: 'badge-green', B: 'badge-blue', C: 'badge-yellow', D: 'badge-yellow', F: 'badge-red',
}

export function GradebookPage() {
  const { courseId } = useParams<{ courseId: string }>()!
  const qc = useQueryClient()
  const { data: gradebook, isLoading } = useGradebook(courseId!)
  const [editingEntry, setEditingEntry] = useState<GradeEntry | null>(null)

  const { mutate: updateEntry, isPending } = useMutation({
    mutationFn: (data: { raw_score: number; max_score: number; category: string }) =>
      api.patch(`/gradebook/entries/${editingEntry!.id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gradebook', courseId] })
      setEditingEntry(null)
    },
  })

  const { register, handleSubmit, reset } = useForm<{ raw_score: string; max_score: string; category: string }>()

  const openEdit = (entry: GradeEntry) => {
    setEditingEntry(entry)
    reset({ raw_score: String(entry.raw_score), max_score: String(entry.max_score), category: entry.category })
  }

  if (isLoading) return <PageLoader />
  if (!gradebook) return <div className="text-center text-slate-500 py-16">Gradebook not found</div>

  // Collect all categories across all students
  const allCategories = Array.from(
    new Set(gradebook.rows.flatMap((r) => r.grades.map((g) => g.category)))
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to={ROUTES.COURSE_DETAIL(courseId!)} className="text-slate-500 hover:text-slate-400">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Gradebook</h1>
          <p className="text-sm text-slate-500">{gradebook.course_title}</p>
        </div>
      </div>

      {!gradebook.rows.length ? (
        <div className="card p-12 text-center text-slate-500">No students enrolled yet.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/50 border-b border-slate-700">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase sticky left-0 bg-slate-800/50 min-w-[180px]">
                  Student
                </th>
                {allCategories.map((cat) => (
                  <th key={cat} className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase capitalize min-w-[100px]">
                    {cat}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase min-w-[100px]">
                  Average
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase min-w-[80px]">
                  Grade
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {gradebook.rows.map((row) => (
                <tr key={row.student_id} className="hover:bg-slate-800/50">
                  <td className="px-4 py-3 sticky left-0 bg-slate-800 hover:bg-slate-700/50">
                    <div>
                      <p className="font-medium text-white">{row.student_name}</p>
                      <p className="text-xs text-slate-500">{row.email}</p>
                    </div>
                  </td>
                  {allCategories.map((cat) => {
                    const entry = row.grades.find((g) => g.category === cat)
                    return (
                      <td key={cat} className="px-4 py-3 text-center">
                        {entry ? (
                          <button
                            onClick={() => openEdit(entry)}
                            className="inline-flex items-center gap-1 text-slate-300 hover:text-primary-600 group"
                          >
                            {entry.raw_score}/{entry.max_score}
                            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-center font-medium text-white">
                    {formatGrade(row.course_average)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.letter_grade ? (
                      <span className={cn('badge', LETTER_COLORS[row.letter_grade] || 'badge-gray')}>
                        {row.letter_grade}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Entry Modal */}
      <Modal isOpen={!!editingEntry} onClose={() => setEditingEntry(null)} title="Edit Grade">
        <form onSubmit={handleSubmit((d) => updateEntry({ raw_score: Number(d.raw_score), max_score: Number(d.max_score), category: d.category }))} className="space-y-4">
          <div>
            <label className="label">Category</label>
            <input {...register('category', { required: true })} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Score</label>
              <input {...register('raw_score', { required: true })} type="number" step="0.5" min="0" className="input" />
            </div>
            <div>
              <label className="label">Max Score</label>
              <input {...register('max_score', { required: true })} type="number" step="0.5" min="1" className="input" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setEditingEntry(null)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1">
              {isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
