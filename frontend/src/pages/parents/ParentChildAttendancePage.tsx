import { useMemo } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useChildOverview, useChildAttendance } from '@/api/parents'
import { PageLoader } from '@/components/ui/Spinner'
import { ArrowLeft, Calendar, TrendingUp, X, StickyNote } from 'lucide-react'
import { cn } from '@/utils/cn'

const ATTENDANCE_STATUS_COLORS: Record<string, string> = {
  present: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  absent: 'bg-red-500/20 text-red-300 border-red-500/40',
  tardy: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
}

const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  present: 'Present',
  absent: 'Absent',
  tardy: 'Tardy',
}

const STATUS_OPTIONS = ['present', 'absent', 'tardy'] as const

type Range = 'all' | '7d' | '30d' | 'month' | 'semester' | 'custom'

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
  { value: 'semester', label: 'This semester' },
  { value: 'custom', label: 'Custom range' },
]

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function resolveRange(range: Range, from: string, to: string): { from?: string; to?: string } {
  if (range === 'all') return {}
  if (range === 'custom') return { from: from || undefined, to: to || undefined }
  const now = new Date()
  const today = toIsoDate(now)
  if (range === '7d') {
    const f = new Date(now); f.setDate(now.getDate() - 6)
    return { from: toIsoDate(f), to: today }
  }
  if (range === '30d') {
    const f = new Date(now); f.setDate(now.getDate() - 29)
    return { from: toIsoDate(f), to: today }
  }
  if (range === 'month') {
    return { from: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today }
  }
  const m = now.getMonth(); const y = now.getFullYear()
  return m >= 7 ? { from: `${y}-08-01`, to: `${y}-12-31` } : { from: `${y}-01-01`, to: `${y}-05-31` }
}

export function ParentChildAttendancePage() {
  const { studentId } = useParams<{ studentId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const { data: child, isLoading: childLoading } = useChildOverview(studentId ?? '')
  const { data: attendanceData, isLoading: attendanceLoading } = useChildAttendance(studentId ?? '')

  const rangeParam = (searchParams.get('range') as Range) || 'all'
  const fromParam = searchParams.get('from') ?? ''
  const toParam = searchParams.get('to') ?? ''
  const statusParam = searchParams.get('status') ?? ''
  const courseParam = searchParams.get('course') ?? ''
  const notesParam = searchParams.get('notes') === '1'

  const selectedStatuses = useMemo(
    () => (statusParam ? statusParam.split(',').filter(Boolean) : []),
    [statusParam],
  )

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (value === null || value === '') next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  const setRange = (next: Range) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'all') {
      params.delete('range'); params.delete('from'); params.delete('to')
    } else if (next === 'custom') {
      params.set('range', 'custom')
    } else {
      params.set('range', next); params.delete('from'); params.delete('to')
    }
    setSearchParams(params, { replace: true })
  }

  const toggleStatus = (status: string) => {
    const next = selectedStatuses.includes(status)
      ? selectedStatuses.filter((s) => s !== status)
      : [...selectedStatuses, status]
    updateParam('status', next.join(','))
  }

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams)
    ;['range', 'from', 'to', 'status', 'course', 'notes'].forEach((k) => next.delete(k))
    setSearchParams(next, { replace: true })
  }

  const hasActiveFilters =
    rangeParam !== 'all' || selectedStatuses.length > 0 || !!courseParam || notesParam

  const { from: effectiveFrom, to: effectiveTo } = useMemo(
    () => resolveRange(rangeParam, fromParam, toParam),
    [rangeParam, fromParam, toParam],
  )

  const courseOptions = useMemo(
    () =>
      (attendanceData ?? []).map((c: any) => ({
        id: String(c.course_id),
        title: c.course_title as string,
      })),
    [attendanceData],
  )

  const recordMatchesFilters = (record: any) => {
    if (effectiveFrom && record.date < effectiveFrom) return false
    if (effectiveTo && record.date > effectiveTo) return false
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(record.status)) return false
    if (notesParam && !(record.notes && String(record.notes).trim())) return false
    return true
  }

  const filteredCourses = useMemo(() => {
    if (!attendanceData) return []
    return attendanceData
      .filter((course: any) => !courseParam || String(course.course_id) === courseParam)
      .map((course: any) => {
        const records = course.attendance_records.filter(recordMatchesFilters)
        const present = records.filter((r: any) => r.status === 'present').length
        const rate = records.length > 0 ? ((present / records.length) * 100).toFixed(1) : '0.0'
        return { ...course, attendance_records: records, filtered_rate: rate }
      })
  }, [attendanceData, courseParam, effectiveFrom, effectiveTo, selectedStatuses, notesParam])

  const allFilteredRecords = useMemo(
    () => filteredCourses.flatMap((c: any) => c.attendance_records),
    [filteredCourses],
  )

  const totalRawRecords = useMemo(
    () =>
      (attendanceData ?? []).reduce(
        (sum: number, c: any) => sum + c.attendance_records.length,
        0,
      ),
    [attendanceData],
  )

  if (childLoading || attendanceLoading) return <PageLoader />

  if (!child) {
    return (
      <div className="card p-12 text-center text-ink-muted">
        <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p>Child not found or you don't have access to this student's data</p>
      </div>
    )
  }

  const totalRecords = allFilteredRecords.length
  const presentCount = allFilteredRecords.filter((r: any) => r.status === 'present').length
  const absentCount = allFilteredRecords.filter((r: any) => r.status === 'absent').length
  const tardyCount = allFilteredRecords.filter((r: any) => r.status === 'tardy').length
  const attendanceRate = totalRecords > 0 ? ((presentCount / totalRecords) * 100).toFixed(1) : '0.0'

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
          <h2 className="text-2xl font-bold text-ink">{child.student_name}'s Attendance</h2>
          <p className="text-ink-muted text-sm mt-1">{child.relationship} • {child.email}</p>
        </div>
      </div>

      {/* Filter toolbar */}
      {totalRawRecords > 0 && (
        <div className="card px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Date range */}
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-muted pointer-events-none" />
              <select
                value={rangeParam}
                onChange={(e) => setRange(e.target.value as Range)}
                className={cn(controlBase, 'pl-8 pr-3 cursor-pointer')}
              >
                {RANGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Course */}
            <select
              value={courseParam}
              onChange={(e) => updateParam('course', e.target.value)}
              className={cn(controlBase, 'px-3 cursor-pointer max-w-[200px]')}
            >
              <option value="">All courses</option>
              {courseOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>

            {/* Divider */}
            <div className="h-5 w-px bg-border mx-1" />

            {/* Status pills */}
            <div className="flex items-center gap-1">
              {STATUS_OPTIONS.map((s) => {
                const active = selectedStatuses.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleStatus(s)}
                    className={cn(
                      'h-8 px-3 rounded-full text-xs font-medium border transition-colors',
                      active
                        ? ATTENDANCE_STATUS_COLORS[s]
                        : 'bg-transparent border-border text-ink-muted hover:border-border-strong hover:text-ink-secondary',
                    )}
                  >
                    {ATTENDANCE_STATUS_LABELS[s]}
                  </button>
                )
              })}
            </div>

            {/* Has notes */}
            <button
              type="button"
              onClick={() => updateParam('notes', notesParam ? null : '1')}
              className={cn(
                'h-8 inline-flex items-center gap-1.5 px-3 rounded-full text-xs font-medium border transition-colors',
                notesParam
                  ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                  : 'bg-transparent border-border text-ink-muted hover:border-border-strong hover:text-ink-secondary',
              )}
            >
              <StickyNote className="h-3 w-3" />
              With notes
            </button>

            {/* Right side: meta + clear */}
            <div className="ml-auto flex items-center gap-3 text-xs text-ink-muted">
              <span>
                <span className="text-ink font-medium">{totalRecords}</span> of {totalRawRecords}
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

          {/* Custom date inputs */}
          {rangeParam === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border/60">
              <span className="text-xs text-ink-muted">From</span>
              <input
                type="date"
                value={fromParam}
                onChange={(e) => updateParam('from', e.target.value)}
                className={cn(controlBase, 'px-2')}
              />
              <span className="text-xs text-ink-muted">to</span>
              <input
                type="date"
                value={toParam}
                onChange={(e) => updateParam('to', e.target.value)}
                className={cn(controlBase, 'px-2')}
              />
            </div>
          )}
        </div>
      )}

      {/* Attendance stats */}
      {totalRawRecords > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-600/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs text-ink-muted font-medium">Attendance Rate</p>
                <p className="text-lg font-bold text-ink">{attendanceRate}%</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-ink-muted font-medium">Present</p>
                <p className="text-lg font-bold text-emerald-400">{presentCount}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-ink-muted font-medium">Absent</p>
                <p className="text-lg font-bold text-red-400">{absentCount}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-600/20 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-ink-muted font-medium">Tardy</p>
                <p className="text-lg font-bold text-amber-400">{tardyCount}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No attendance state */}
      {totalRawRecords === 0 ? (
        <div className="card p-12 text-center text-ink-muted">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No attendance records found</p>
          <p className="text-sm mt-2">Attendance data will appear here once teachers start recording it</p>
        </div>
      ) : totalRecords === 0 ? (
        <div className="card p-12 text-center text-ink-muted">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No records match the current filters</p>
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
          {filteredCourses.map((course: any) => (
            course.attendance_records.length > 0 && (
              <div key={course.course_id} className="card overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                  <h3 className="font-semibold text-ink">{course.course_title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-ink-muted">
                      {course.attendance_records.length} records
                    </span>
                    <span className="text-lg font-bold text-ink">{course.filtered_rate}%</span>
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-elevated/50 text-left">
                      <th className="px-6 py-2 text-xs font-medium text-ink-muted uppercase">Date</th>
                      <th className="px-6 py-2 text-xs font-medium text-ink-muted uppercase">Status</th>
                      <th className="px-6 py-2 text-xs font-medium text-ink-muted uppercase">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {course.attendance_records.map((record: any) => (
                      <tr key={record.id} className="hover:bg-surface-elevated/50">
                        <td className="px-6 py-3 text-ink-secondary">
                          {new Date(record.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-3">
                          <span className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-bold border',
                            ATTENDANCE_STATUS_COLORS[record.status] || 'bg-surface-elevated text-ink-muted border-border-strong/30'
                          )}>
                            {ATTENDANCE_STATUS_LABELS[record.status] || record.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-ink-muted text-xs">
                          {record.notes || '—'}
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
