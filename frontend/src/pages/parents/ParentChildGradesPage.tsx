import { useMemo } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useChildOverview, useChildGrades } from '@/api/parents'
import { PageLoader } from '@/components/ui/Spinner'
import { ArrowLeft, GraduationCap, TrendingUp, X, AlertTriangle, BookOpen } from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatGrade } from '@/utils/formatters'

const LETTER_COLORS: Record<string, string> = {
  A: 'text-green-600 bg-green-50',
  B: 'text-blue-600 bg-blue-50',
  C: 'text-yellow-600 bg-yellow-50',
  D: 'text-orange-600 bg-orange-50',
  F: 'text-red-600 bg-red-50',
}

const LETTER_PILL_ACTIVE: Record<string, string> = {
  A: 'bg-green-500/20 border-green-500/40 text-green-300',
  B: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
  C: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
  D: 'bg-orange-500/20 border-orange-500/40 text-orange-300',
  F: 'bg-red-500/20 border-red-500/40 text-red-300',
}

const LETTER_OPTIONS = ['A', 'B', 'C', 'D', 'F'] as const
const BELOW_THRESHOLD = 70

export function ParentChildGradesPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const { data: child, isLoading: childLoading } = useChildOverview(studentId ?? '')
  const { data: grades, isLoading: gradesLoading } = useChildGrades(studentId ?? '')

  const courseParam = searchParams.get('course') ?? ''
  const categoryParam = searchParams.get('category') ?? ''
  const letterParam = searchParams.get('letter') ?? ''
  const belowParam = searchParams.get('below') === '1'

  const selectedCategories = useMemo(
    () => (categoryParam ? categoryParam.split(',').filter(Boolean) : []),
    [categoryParam],
  )
  const selectedLetters = useMemo(
    () => (letterParam ? letterParam.split(',').filter(Boolean) : []),
    [letterParam],
  )

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (value === null || value === '') next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  const toggleInList = (key: 'category' | 'letter', value: string) => {
    const current = key === 'category' ? selectedCategories : selectedLetters
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    updateParam(key, next.join(','))
  }

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams)
    ;['course', 'category', 'letter', 'below'].forEach((k) => next.delete(k))
    setSearchParams(next, { replace: true })
  }

  const hasActiveFilters =
    !!courseParam || selectedCategories.length > 0 || selectedLetters.length > 0 || belowParam

  const courseOptions = useMemo(
    () =>
      (grades ?? []).map((s: any) => ({
        id: String(s.course_id),
        title: s.course_title as string,
      })),
    [grades],
  )

  const categoryOptions = useMemo(() => {
    const set = new Set<string>()
    grades?.forEach((summary: any) => {
      summary.entries?.forEach((entry: any) => {
        if (entry.category) set.add(String(entry.category))
      })
    })
    return Array.from(set).sort()
  }, [grades])

  const entryPercent = (entry: any): number | null => {
    const max = Number(entry.max_score)
    const raw = Number(entry.raw_score)
    if (!isFinite(max) || max <= 0 || !isFinite(raw)) return null
    return (raw / max) * 100
  }

  const entryMatchesFilters = (entry: any) => {
    if (selectedCategories.length > 0 && !selectedCategories.includes(String(entry.category))) {
      return false
    }
    if (selectedLetters.length > 0 && !selectedLetters.includes(entry.letter_grade)) return false
    if (belowParam) {
      const pct = entryPercent(entry)
      if (pct === null || pct >= BELOW_THRESHOLD) return false
    }
    return true
  }

  const filteredSummaries = useMemo(() => {
    if (!grades) return []
    return grades
      .filter((s: any) => !courseParam || String(s.course_id) === courseParam)
      .map((summary: any) => {
        const entries = (summary.entries ?? []).filter(entryMatchesFilters)
        const percents = entries
          .map(entryPercent)
          .filter((p: number | null): p is number => p !== null)
        const average =
          percents.length > 0 ? percents.reduce((a: number, b: number) => a + b, 0) / percents.length : null
        return { ...summary, entries, filtered_average: average }
      })
  }, [grades, courseParam, selectedCategories, selectedLetters, belowParam])

  const totalRawEntries = useMemo(
    () => (grades ?? []).reduce((sum: number, s: any) => sum + (s.entries?.length ?? 0), 0),
    [grades],
  )
  const totalFilteredEntries = useMemo(
    () => filteredSummaries.reduce((sum: number, s: any) => sum + s.entries.length, 0),
    [filteredSummaries],
  )

  if (childLoading || gradesLoading) return <PageLoader />

  if (!child) {
    return (
      <div className="card p-12 text-center text-slate-500">
        <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p>Child not found or you don't have access to this student's data</p>
      </div>
    )
  }

  const controlBase =
    'h-8 inline-flex items-center text-sm rounded-md border border-slate-700/60 bg-slate-800/60 text-slate-200 hover:border-slate-600 focus:outline-none focus:border-indigo-500'

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

      {/* Filter toolbar */}
      {grades && grades.length > 0 && (
        <div className="card px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Course */}
            <div className="relative">
              <BookOpen className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <select
                value={courseParam}
                onChange={(e) => updateParam('course', e.target.value)}
                className={cn(controlBase, 'pl-8 pr-3 cursor-pointer max-w-[220px]')}
              >
                <option value="">All courses</option>
                {courseOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>

            {/* Divider */}
            <div className="h-5 w-px bg-slate-700/60 mx-1" />

            {/* Letter grade pills */}
            <div className="flex items-center gap-1">
              {LETTER_OPTIONS.map((letter) => {
                const active = selectedLetters.includes(letter)
                return (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => toggleInList('letter', letter)}
                    className={cn(
                      'h-8 w-8 inline-flex items-center justify-center rounded-full text-xs font-bold border transition-colors',
                      active
                        ? LETTER_PILL_ACTIVE[letter]
                        : 'bg-transparent border-slate-700/60 text-slate-400 hover:border-slate-600 hover:text-slate-300',
                    )}
                  >
                    {letter}
                  </button>
                )
              })}
            </div>

            {/* Below threshold */}
            <button
              type="button"
              onClick={() => updateParam('below', belowParam ? null : '1')}
              className={cn(
                'h-8 inline-flex items-center gap-1.5 px-3 rounded-full text-xs font-medium border transition-colors',
                belowParam
                  ? 'bg-red-500/20 border-red-500/40 text-red-300'
                  : 'bg-transparent border-slate-700/60 text-slate-400 hover:border-slate-600 hover:text-slate-300',
              )}
            >
              <AlertTriangle className="h-3 w-3" />
              Below {BELOW_THRESHOLD}%
            </button>

            {/* Right side: meta + clear */}
            <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
              <span>
                <span className="text-slate-200 font-medium">{totalFilteredEntries}</span> of {totalRawEntries}
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200"
                >
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Categories — second row only when there's something to filter */}
          {categoryOptions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-slate-700/40">
              {categoryOptions.map((cat) => {
                const active = selectedCategories.includes(cat)
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleInList('category', cat)}
                    className={cn(
                      'h-7 px-2.5 rounded-full text-xs capitalize border transition-colors',
                      active
                        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                        : 'bg-transparent border-slate-700/60 text-slate-400 hover:border-slate-600 hover:text-slate-300',
                    )}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* No grades state */}
      {!grades || grades.length === 0 ? (
        <div className="card p-12 text-center text-slate-500">
          <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No grades recorded yet</p>
          <p className="text-sm mt-2">Grades will appear here once teachers post them</p>
        </div>
      ) : totalFilteredEntries === 0 ? (
        <div className="card p-12 text-center text-slate-500">
          <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No grade entries match the current filters</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 text-sm text-indigo-400 hover:text-indigo-300"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSummaries.map((summary: any) => (
            summary.entries.length > 0 && (
              <div key={summary.course_id} className="card overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60">
                  <h3 className="font-semibold text-white">{summary.course_title}</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-white">
                      {summary.filtered_average !== null
                        ? formatGrade(summary.filtered_average)
                        : formatGrade(summary.average)}
                    </span>
                    {summary.letter_grade && (
                      <span className={cn('w-9 h-9 flex items-center justify-center rounded-full text-sm font-bold', LETTER_COLORS[summary.letter_grade] || 'text-slate-400 bg-slate-700/50')}>
                        {summary.letter_grade}
                      </span>
                    )}
                  </div>
                </div>

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
              </div>
            )
          ))}
        </div>
      )}
    </div>
  )
}
