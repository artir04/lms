import { useMyGrades } from '@/api/grades'
import { PageLoader } from '@/components/ui/Spinner'
import { GraduationCap } from 'lucide-react'
import { formatGrade } from '@/utils/formatters'
import { cn } from '@/utils/cn'

const LETTER_COLORS: Record<string, string> = {
  A: 'text-green-600 bg-green-50', B: 'text-blue-600 bg-blue-50',
  C: 'text-yellow-600 bg-yellow-50', D: 'text-orange-600 bg-orange-50',
  F: 'text-red-600 bg-red-50',
}

export function MyGradesPage() {
  const { data: grades, isLoading } = useMyGrades()

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">My Grades</h2>

      {!grades?.length ? (
        <div className="card p-12 text-center text-slate-500">
          <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No grades yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grades.map((summary) => (
            <div key={summary.course_id} className="card overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60">
                <h3 className="font-semibold text-white">{summary.course_title}</h3>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-white">{formatGrade(summary.average)}</span>
                  {summary.letter_grade && (
                    <span className={cn('w-9 h-9 flex items-center justify-center rounded-full text-sm font-bold', LETTER_COLORS[summary.letter_grade] || 'text-slate-400 bg-slate-700/50')}>
                      {summary.letter_grade}
                    </span>
                  )}
                </div>
              </div>

              {summary.entries.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800/50 text-left">
                      <th className="px-6 py-2 text-xs font-medium text-slate-500 uppercase">Assignment</th>
                      <th className="px-6 py-2 text-xs font-medium text-slate-500 uppercase">Score</th>
                      <th className="px-6 py-2 text-xs font-medium text-slate-500 uppercase">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40">
                    {summary.entries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-800/50">
                        <td className="px-6 py-3 text-slate-300 capitalize">{entry.category}</td>
                        <td className="px-6 py-3 text-slate-300">
                          {entry.raw_score} / {entry.max_score}
                        </td>
                        <td className="px-6 py-3">
                          {entry.letter_grade ? (
                            <span className={cn('badge', LETTER_COLORS[entry.letter_grade] ? 'badge' : 'badge-gray')}>
                              {entry.letter_grade}
                            </span>
                          ) : '—'}
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
