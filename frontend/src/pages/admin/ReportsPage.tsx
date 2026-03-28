import { useAdminReport } from '@/api/reports'
import { PageLoader } from '@/components/ui/Spinner'
import { StatCard } from '@/components/ui/StatCard'
import { formatGrade } from '@/utils/formatters'
import { cn } from '@/utils/cn'
import { Users, BookOpen, GraduationCap, UserCheck, Activity, TrendingUp, Download } from 'lucide-react'

export function ReportsPage() {
  const { data: report, isLoading } = useAdminReport()

  if (isLoading) return <PageLoader />
  if (!report) return <div className="text-center text-ink-muted py-16">Could not load report</div>

  const exportCSV = () => {
    const header = 'Course,Teacher,Enrolled,Avg Grade,Attendance Rate\n'
    const rows = report.courses.map((c) =>
      `"${c.course_title}","${c.teacher_name}",${c.enrolled_count},${c.avg_grade ?? 'N/A'},${c.avg_attendance_rate ?? 'N/A'}%`
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lms-report.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-ink font-display">Platform Reports</h2>
        <button onClick={exportCSV} className="btn-secondary flex items-center gap-2">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Students" value={report.total_students} icon={<Users className="h-5 w-5" />} color="indigo" />
        <StatCard title="Teachers" value={report.total_teachers} icon={<GraduationCap className="h-5 w-5" />} color="emerald" />
        <StatCard title="Parents" value={report.total_parents} icon={<UserCheck className="h-5 w-5" />} color="purple" />
        <StatCard title="Courses" value={report.total_courses} icon={<BookOpen className="h-5 w-5" />} color="sky" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 text-center">
          <Activity className="w-6 h-6 text-primary-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-ink font-display">{report.active_users_30d}</p>
          <p className="text-xs text-ink-muted uppercase mt-1">Active Users (30d)</p>
        </div>
        <div className="card p-5 text-center">
          <TrendingUp className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-ink font-display">
            {report.avg_platform_grade != null ? formatGrade(report.avg_platform_grade) : '—'}
          </p>
          <p className="text-xs text-ink-muted uppercase mt-1">Avg Platform Grade</p>
        </div>
        <div className="card p-5 text-center">
          <Users className="w-6 h-6 text-amber-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-ink font-display">
            {report.avg_attendance_rate != null ? `${report.avg_attendance_rate}%` : '—'}
          </p>
          <p className="text-xs text-ink-muted uppercase mt-1">Avg Attendance Rate</p>
        </div>
      </div>

      {/* Course table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-ink font-display">Course Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-elevated/50 text-left">
                <th className="px-5 py-2 text-xs font-medium text-ink-muted uppercase">Course</th>
                <th className="px-5 py-2 text-xs font-medium text-ink-muted uppercase">Teacher</th>
                <th className="px-5 py-2 text-xs font-medium text-ink-muted uppercase text-center">Enrolled</th>
                <th className="px-5 py-2 text-xs font-medium text-ink-muted uppercase text-center">Avg Grade</th>
                <th className="px-5 py-2 text-xs font-medium text-ink-muted uppercase text-center">Attendance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {report.courses.map((c) => (
                <tr key={c.course_id} className="hover:bg-surface-elevated/50">
                  <td className="px-5 py-3 text-ink font-medium">{c.course_title}</td>
                  <td className="px-5 py-3 text-ink-secondary">{c.teacher_name}</td>
                  <td className="px-5 py-3 text-center text-ink-secondary">{c.enrolled_count}</td>
                  <td className="px-5 py-3 text-center">
                    {c.avg_grade != null ? (
                      <span className="text-ink font-medium">{formatGrade(c.avg_grade)}</span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {c.avg_attendance_rate != null ? (
                      <span className={cn(
                        'font-medium',
                        c.avg_attendance_rate >= 90 ? 'text-emerald-400' :
                        c.avg_attendance_rate >= 75 ? 'text-amber-400' : 'text-rose-400'
                      )}>
                        {c.avg_attendance_rate}%
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
