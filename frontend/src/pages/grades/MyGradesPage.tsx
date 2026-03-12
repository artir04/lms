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
      <h2 className="text-2xl font-bold text-gray-900">My Grades</h2>

      {!grades?.length ? (
        <div className="card p-12 text-center text-gray-400">
          <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No grades yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grades.map((summary) => (
            <div key={summary.course_id} className="card overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">{summary.course_title}</h3>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-900">{formatGrade(summary.average)}</span>
                  {summary.letter_grade && (
                    <span className={cn('w-9 h-9 flex items-center justify-center rounded-full text-sm font-bold', LETTER_COLORS[summary.letter_grade] || 'text-gray-600 bg-gray-100')}>
                      {summary.letter_grade}
                    </span>
                  )}
                </div>
              </div>

              {summary.entries.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-6 py-2 text-xs font-medium text-gray-500 uppercase">Assignment</th>
                      <th className="px-6 py-2 text-xs font-medium text-gray-500 uppercase">Score</th>
                      <th className="px-6 py-2 text-xs font-medium text-gray-500 uppercase">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {summary.entries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 text-gray-700 capitalize">{entry.category}</td>
                        <td className="px-6 py-3 text-gray-700">
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
