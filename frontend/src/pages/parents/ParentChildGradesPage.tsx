import { useMemo } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useChildOverview, useChildGrades } from '@/api/parents'
import { PageLoader } from '@/components/ui/Spinner'
import { ArrowLeft, GraduationCap, TrendingUp, X, AlertTriangle, BookOpen } from 'lucide-react'
import { cn } from '@/utils/cn'

const GRADE_COLORS: Record<number, string> = {
  5: 'text-emerald-400 bg-emerald-500/15',
  4: 'text-sky-400 bg-sky-500/15',
  3: 'text-amber-400 bg-amber-500/15',
  2: 'text-orange-400 bg-orange-500/15',
  1: 'text-rose-400 bg-rose-500/15',
}

const GRADE_PILL_ACTIVE: Record<number, string> = {
  5: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
  4: 'bg-sky-500/20 border-sky-500/40 text-sky-300',
  3: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
  2: 'bg-orange-500/20 border-orange-500/40 text-orange-300',
  1: 'bg-rose-500/20 border-rose-500/40 text-rose-300',
}

const GRADE_OPTIONS = [5, 4, 3, 2, 1] as const
const BELOW_GRADE = 3

const GRADE_LABELS: Record<number, string> = {
  5: 'Excellent',
  4: 'Good',
  3: 'Satisfactory',
  2: 'Sufficient',
  1: 'Insufficient',
}

export function ParentChildGradesPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const { data: child, isLoading: childLoading } = useChildOverview(studentId ?? '')
  const { data: grades, isLoading: gradesLoading } = useChildGrades(studentId ?? '')

  const courseParam = searchParams.get('course') ?? ''
  const categoryParam = searchParams.get('category') ?? ''
  const gradeParam = searchParams.get('grade') ?? ''
  const belowParam = searchParams.get('below') === '1'

  const selectedCategories = useMemo(
    () => (categoryParam ? categoryParam.split(',').filter(Boolean) : []),
    [categoryParam],
  )
  const selectedGrades = useMemo(
    () => (gradeParam ? gradeParam.split(',').map(Number).filter((n) => !isNaN(n)) : []),
    [gradeParam],
  )

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (value === null || value === '') next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  const toggleGrade = (grade: number) => {
    const next = selectedGrades.includes(grade)
      ? selectedGrades.filter((v) => v !== grade)
      : [...selectedGrades, grade]
    updateParam('grade', next.join(','))
  }

  const toggleCategory = (cat: string) => {
    const next = selectedCategories.includes(cat)
      ? selectedCategories.filter((v) => v !== cat)
      : [...selectedCategories, cat]
    updateParam('category', next.join(','))
  }

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams)
    ;['course', 'category', 'grade', 'below'].forEach((k) => next.delete(k))
    setSearchParams(next, { replace: true })
  }

  const hasActiveFilters =
    !!courseParam || selectedCategories.length > 0 || selectedGrades.length > 0 || belowParam

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

  const entryMatchesFilters = (entry: any) => {
    if (selectedCategories.length > 0 && !selectedCategories.includes(String(entry.category))) {
      return false
    }
    if (selectedGrades.length > 0 && !selectedGrades.includes(entry.grade)) return false
    if (belowParam && entry.grade >= BELOW_GRADE) return false
    return true
  }

  const filteredSummaries = useMemo(() => {
    if (!grades) return []
    return grades
      .filter((s: any) => !courseParam || String(s.course_id) === courseParam)
      .map((summary: any) => {
        const entries = (summary.entries ?? []).filter(entryMatchesFilters)
        const gradesArr = entries.map((e: any) => e.grade).filter((g: number) => g != null)
        const average =
          gradesArr.length > 0
            ? gradesArr.reduce((a: number, b: number) => a + b, 0) / gradesArr.length
            : null
        return { ...summary, entries, filtered_average: average }
      })
  }, [grades, courseParam, selectedCategories, selectedGrades, belowParam])

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
      <div className="card p-12 text-center text-ink-muted">
        <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p>Child not found or you don't have access to this student's data</p>
      </div>
    )
  }

  const controlBase =
    'h-8 inline-flex items-center text-sm rounded-md border border-border bg-surface-elevated text-ink hover:border-border-strong focus:outline-none focus:border-indigo-500'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/parent"
            className="text-sm text-ink-muted hover:text-ink-secondary flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Parent Portal
          </Link>
          <h2 className="text-2xl font-bold text-ink">{child.student_name}'s Grades</h2>
          <p className="text-ink-muted text-sm mt-1">{child.relationship} • {child.email}</p>
        </div>
      </div>

      {/* Filter toolbar */}
      {grades && grades.length > 0 && (
        <div className="card px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Course */}
            <div className="relative">
              <BookOpen className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-muted pointer-events-none" />
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
            <div className="h-5 w-px bg-border mx-1" />

            {/* Grade pills (1-5) */}
            <div className="flex items-center gap-1">
              {GRADE_OPTIONS.map((grade) => {
                const active = selectedGrades.includes(grade)
                return (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => toggleGrade(grade)}
                    title={GRADE_LABELS[grade]}
                    className={cn(
                      'h-8 w-8 inline-flex items-center justify-center rounded-full text-xs font-bold border transition-colors',
                      active
                        ? GRADE_PILL_ACTIVE[grade]
                        : 'bg-transparent border-border text-ink-muted hover:border-border-strong hover:text-ink-secondary',
                    )}
                  >
                    {grade}
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
                  : 'bg-transparent border-border text-ink-muted hover:border-border-strong hover:text-ink-secondary',
              )}
            >
              <AlertTriangle className="h-3 w-3" />
              Below {BELOW_GRADE}
            </button>

            {/* Right side: meta + clear */}
            <div className="ml-auto flex items-center gap-3 text-xs text-ink-muted">
              <span>
                <span className="text-ink font-medium">{totalFilteredEntries}</span> of {totalRawEntries}
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 text-ink-muted hover:text-ink"
                >
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Categories — second row only when there's something to filter */}
          {categoryOptions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-border/60">
              {categoryOptions.map((cat) => {
                const active = selectedCategories.includes(cat)
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={cn(
                      'h-7 px-2.5 rounded-full text-xs capitalize border transition-colors',
                      active
                        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                        : 'bg-transparent border-border text-ink-muted hover:border-border-strong hover:text-ink-secondary',
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
        <div className="card p-12 text-center text-ink-muted">
          <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No grades recorded yet</p>
          <p className="text-sm mt-2">Grades will appear here once teachers post them</p>
        </div>
      ) : totalFilteredEntries === 0 ? (
        <div className="card p-12 text-center text-ink-muted">
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
          {filteredSummaries.map((summary: any) =>
            summary.entries.length > 0 && (
              <div key={summary.course_id} className="card overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                  <h3 className="font-semibold text-ink">{summary.course_title}</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-ink">
                      {summary.filtered_average !== null
                        ? summary.filtered_average.toFixed(2)
                        : Number(summary.average) > 0
                          ? Number(summary.average).toFixed(2)
                          : '—'}
                    </span>
                    {summary.final_grade != null && (
                      <span className={cn('w-9 h-9 flex items-center justify-center rounded-full text-sm font-bold', GRADE_COLORS[summary.final_grade] || 'text-ink-muted bg-surface-elevated')}>
                        {summary.final_grade}
                      </span>
                    )}
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-elevated/50 text-left">
                      <th className="px-6 py-2 text-xs font-medium text-ink-muted uppercase">Assignment</th>
                      <th className="px-6 py-2 text-xs font-medium text-ink-muted uppercase">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {summary.entries.map((entry: any) => (
                      <tr key={entry.id} className="hover:bg-surface-elevated/50">
                        <td className="px-6 py-3 text-ink-secondary capitalize">{entry.category}</td>
                        <td className="px-6 py-3">
                          <span className={cn('px-2.5 py-1 rounded-full text-xs font-bold', GRADE_COLORS[entry.grade] || 'bg-surface-elevated text-ink-muted')}>
                            {entry.grade}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
