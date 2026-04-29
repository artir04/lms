import { useParams, Link, useNavigate } from 'react-router-dom'
import { useChildOverview, useChildGrades } from '@/api/parents'
import { PageLoader } from '@/components/ui/Spinner'
import { ArrowLeft, GraduationCap, TrendingUp } from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatGrade } from '@/utils/formatters'

const LETTER_COLORS: Record<string, string> = {
  A: 'text-green-600 bg-green-50',
  B: 'text-blue-600 bg-blue-50',
  C: 'text-yellow-600 bg-yellow-50',
  D: 'text-orange-600 bg-orange-50',
  F: 'text-red-600 bg-red-50',
}

export function ParentChildGradesPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const navigate = useNavigate()

  const { data: child, isLoading: childLoading } = useChildOverview(studentId ?? '')
  const { data: grades, isLoading: gradesLoading } = useChildGrades(studentId ?? '')

  if (childLoading || gradesLoading) return <PageLoader />

  if (!child) {
    return (
      <div className="card p-12 text-center text-slate-500">
        <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p>Child not found or you don't have access to this student's data</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/parent"
            className="text-sm text-slate-400 hover:text-slate-300 flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Parent Portal
          </Link>
          <h2 className="text-2xl font-bold text-white">{child.student_name}'s Grades</h2>
          <p className="text-slate-400 text-sm mt-1">{child.relationship} • {child.email}</p>
        </div>
      </div>

      {/* No grades state */}
      {!grades || grades.length === 0 ? (
        <div className="card p-12 text-center text-slate-500">
          <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No grades recorded yet</p>
          <p className="text-sm mt-2">Grades will appear here once teachers post them</p>
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

              {summary.entries && summary.entries.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800/50 text-left">
                      <th className="px-6 py-2 text-xs font-medium text-slate-500 uppercase">Assignment</th>
                      <th className="px-6 py-2 text-xs font-medium text-slate-500 uppercase">Score</th>
                      <th className="px-6 py-2 text-xs font-medium text-slate-500 uppercase">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40">
                    {summary.entries.map((entry: any) => (
                      <tr key={entry.id} className="hover:bg-slate-800/50">
                        <td className="px-6 py-3 text-slate-300 capitalize">{entry.category}</td>
                        <td className="px-6 py-3 text-slate-300">
                          {entry.raw_score} / {entry.max_score}
                        </td>
                        <td className="px-6 py-3">
                          {entry.letter_grade ? (
                            <span className={cn('px-2.5 py-1 rounded-full text-xs font-bold', LETTER_COLORS[entry.letter_grade] || 'bg-slate-700/50 text-slate-400')}>
                              {entry.letter_grade}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-6 text-center text-slate-500 text-sm">
                  No individual grades posted for this course yet
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}