import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { ArrowLeft, Download, BarChart3, TrendingUp, TrendingDown } from 'lucide-react'
import { useCourse } from '@/api/courses'
import { useAttendanceReport } from '@/api/attendance'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/utils/formatters'

export function AttendanceReportPage() {
  const { courseId } = useParams<{ courseId: string }>()!
  const { user } = useAuth()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data: course, isLoading: courseLoading } = useCourse(courseId!)
  const { data: report, isLoading: reportLoading } = useAttendanceReport(courseId!, {
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  })

  // Calculate statistics
  const stats = report?.rows.reduce(
    (acc, row) => {
      acc.totalAttendance += row.attendance_count
      acc.totalPresent += row.present_count
      acc.totalAbsent += row.absent_count
      acc.totalTardy += row.tardy_count
      acc.totalRate += row.attendance_rate
      return acc
    },
    { totalAttendance: 0, totalPresent: 0, totalAbsent: 0, totalTardy: 0, totalRate: 0 }
  ) || { totalAttendance: 0, totalPresent: 0, totalAbsent: 0, totalTardy: 0, totalRate: 0 }

  const avgRate = report?.rows.length ? Math.round(stats.totalRate / report.rows.length) : 0

  const handleExport = () => {
    if (!report) return

    const csv = [
      ['Student Name', 'Email', 'Total Days', 'Present', 'Absent', 'Tardy', 'Attendance Rate'].join(','),
      ...report.rows.map((row) => [
        `"${row.student_name}"`,
        row.email,
        row.attendance_count,
        row.present_count,
        row.absent_count,
        row.tardy_count,
        `${row.attendance_rate}%`,
      ].join(',')),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance-report-${course?.title || 'course'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (courseLoading || reportLoading) return <PageLoader />
  if (!course) return <div className="text-center text-ink-muted py-16">Course not found</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/courses/${courseId}`} className="text-ink-muted hover:text-ink-secondary transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-ink font-display">Attendance Report</h1>
          <p className="text-sm text-ink-muted">{course.title}</p>
        </div>
        <button onClick={handleExport} className="btn-secondary">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="card p-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="label">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="label">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input"
            />
          </div>
          <button
            onClick={() => { setDateFrom(''); setDateTo('') }}
            className="btn-secondary self-end"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Overall Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
            <BarChart3 className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-ink font-display">{stats.totalAttendance}</p>
            <p className="text-xs text-ink-muted">Total Records</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-400 font-display">{avgRate}%</p>
            <p className="text-xs text-ink-muted">Avg Attendance</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
            <TrendingDown className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-red-400 font-display">{stats.totalAbsent}</p>
            <p className="text-xs text-ink-muted">Total Absences</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-400 font-display">{stats.totalTardy}</p>
            <p className="text-xs text-ink-muted">Total Tardies</p>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      {!report || report.rows.length === 0 ? (
        <div className="card p-12 text-center text-ink-muted">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No attendance data available</p>
          <p className="text-sm mt-1">
            Mark some attendance for this course to see the report.
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-elevated/50 border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-ink-muted uppercase sticky left-0 bg-surface-elevated/50 min-w-[200px]">
                  Student
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-ink-muted uppercase">
                  Total Days
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-ink-muted uppercase">
                  Present
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-ink-muted uppercase">
                  Absent
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-ink-muted uppercase">
                  Tardy
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-ink-muted uppercase min-w-[120px]">
                  Rate
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {report.rows
                .sort((a, b) => b.attendance_rate - a.attendance_rate)
                .map((row) => (
                  <tr key={row.student_id} className="hover:bg-surface-elevated/50">
                    <td className="px-4 py-3 sticky left-0 bg-surface">
                      <div>
                        <p className="font-medium text-ink">{row.student_name}</p>
                        <p className="text-xs text-ink-muted">{row.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-medium text-ink">{row.attendance_count}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-emerald-400 font-medium">{row.present_count}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-red-400 font-medium">{row.absent_count}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-amber-400 font-medium">{row.tardy_count}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={[
                          'inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-semibold',
                          row.attendance_rate >= 90
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : row.attendance_rate >= 75
                              ? 'bg-amber-500/15 text-amber-400'
                              : 'bg-red-500/15 text-red-400',
                        ].join(' ')}
                      >
                        {Math.round(row.attendance_rate)}%
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Date Range Info */}
      {report && (report.date_range_start || report.date_range_end) && (
        <div className="text-center text-sm text-ink-muted">
          Showing data from{' '}
          {report.date_range_start ? formatDate(report.date_range_start) : 'the beginning'}{' '}
          to {report.date_range_end ? formatDate(report.date_range_end) : 'the present'}
        </div>
      )}
    </div>
  )
}
