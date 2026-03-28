import { useMyGrades } from '@/api/grades'
import { PageLoader } from '@/components/ui/Spinner'
import { GraduationCap } from 'lucide-react'
import { cn } from '@/utils/cn'

const GRADE_COLORS: Record<number, string> = {
  5: 'text-emerald-400 bg-emerald-500/15',
  4: 'text-sky-400 bg-sky-500/15',
  3: 'text-amber-400 bg-amber-500/15',
  2: 'text-orange-400 bg-orange-500/15',
  1: 'text-rose-400 bg-rose-500/15',
}

const GRADE_TEXT: Record<number, string> = {
  5: 'text-emerald-400',
  4: 'text-sky-400',
  3: 'text-amber-400',
  2: 'text-orange-400',
  1: 'text-rose-400',
}

export function MyGradesPage() {
  const { data: grades, isLoading } = useMyGrades()

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-ink font-display">My Grades</h2>

      {!grades?.length ? (
        <div className="card p-12 text-center text-ink-muted">
          <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No grades yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grades.map((summary) => (
            <div key={summary.course_id} className="card overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h3 className="font-semibold text-ink font-display">{summary.course_title}</h3>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-ink-secondary">
                    Avg: <span className="text-ink font-medium">{Number(summary.weighted_average) > 0 ? Number(summary.weighted_average).toFixed(2) : '\u2014'}</span>
                  </span>
                  {summary.final_grade != null && (
                    <span className={cn('w-9 h-9 flex items-center justify-center rounded-full text-sm font-bold', GRADE_COLORS[summary.final_grade] || 'text-ink-muted bg-surface-elevated')}>
                      {summary.final_grade}
                    </span>
                  )}
                </div>
              </div>

              {summary.entries.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-elevated/50 text-left">
                      <th className="px-6 py-2 text-xs font-medium text-ink-muted uppercase">Assessment</th>
                      <th className="px-6 py-2 text-xs font-medium text-ink-muted uppercase text-center">Grade</th>
                      <th className="px-6 py-2 text-xs font-medium text-ink-muted uppercase text-center">Weight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {summary.entries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-surface-elevated/50">
                        <td className="px-6 py-3 text-ink-secondary">
                          {entry.label || <span className="capitalize">{entry.category}</span>}
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className={cn('text-lg font-bold', GRADE_TEXT[entry.grade] || 'text-ink-muted')}>
                            {entry.grade}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center text-ink-muted">
                          {(Number(entry.weight) * 100).toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
