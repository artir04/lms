import { useParams, Link } from 'react-router-dom'
import { useChildOverview, useChildAttendance } from '@/api/parents'
import { PageLoader } from '@/components/ui/Spinner'
import { ArrowLeft, Calendar, TrendingUp } from 'lucide-react'
import { cn } from '@/utils/cn'

const ATTENDANCE_STATUS_COLORS: Record<string, string> = {
  present: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  absent: 'bg-red-500/20 text-red-400 border-red-500/30',
  tardy: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
}

const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  present: 'Present',
  absent: 'Absent',
  tardy: 'Tardy',
}

export function ParentChildAttendancePage() {
  const { studentId } = useParams<{ studentId: string }>()

  const { data: child, isLoading: childLoading } = useChildOverview(studentId ?? '')
  const { data: attendanceData, isLoading: attendanceLoading } = useChildAttendance(studentId ?? '')

  if (childLoading || attendanceLoading) return <PageLoader />

  if (!child) {
    return (
      <div className="card p-12 text-center text-slate-500">
        <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p>Child not found or you don't have access to this student's data</p>
      </div>
    )
  }

  // Flatten attendance records for display
  const allRecords = attendanceData?.flatMap((course: any) =>
    course.attendance_records.map((record: any) => ({
      ...record,
      course_title: course.course_title,
      course_id: course.course_id,
    }))
  ) || []

  // Calculate overall attendance statistics
  const totalRecords = allRecords.length
  const presentCount = allRecords.filter((r: any) => r.status === 'present').length
  const absentCount = allRecords.filter((r: any) => r.status === 'absent').length
  const tardyCount = allRecords.filter((r: any) => r.status === 'tardy').length
  const attendanceRate = totalRecords > 0 ? ((presentCount / totalRecords) * 100).toFixed(1) : '0.0'

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
          <h2 className="text-2xl font-bold text-white">{child.student_name}'s Attendance</h2>
          <p className="text-slate-400 text-sm mt-1">{child.relationship} • {child.email}</p>
        </div>
      </div>

      {/* Attendance stats */}
      {totalRecords > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-600/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Attendance Rate</p>
                <p className="text-lg font-bold text-white">{attendanceRate}%</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Present</p>
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
                <p className="text-xs text-slate-500 font-medium">Absent</p>
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
                <p className="text-xs text-slate-500 font-medium">Tardy</p>
                <p className="text-lg font-bold text-amber-400">{tardyCount}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No attendance state */}
      {totalRecords === 0 ? (
        <div className="card p-12 text-center text-slate-500">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No attendance records found</p>
          <p className="text-sm mt-2">Attendance data will appear here once teachers start recording it</p>
        </div>
      ) : (
        <div className="space-y-4">
          {attendanceData?.map((course: any) => (
            <div key={course.course_id} className="card overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60">
                <h3 className="font-semibold text-white">{course.course_title}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">
                    {course.attendance_records.length} records
                  </span>
                  <span className="text-lg font-bold text-white">{course.attendance_rate}%</span>
                </div>
              </div>

              {course.attendance_records.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800/50 text-left">
                      <th className="px-6 py-2 text-xs font-medium text-slate-500 uppercase">Date</th>
                      <th className="px-6 py-2 text-xs font-medium text-slate-500 uppercase">Status</th>
                      <th className="px-6 py-2 text-xs font-medium text-slate-500 uppercase">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40">
                    {course.attendance_records.map((record: any) => (
                      <tr key={record.id} className="hover:bg-slate-800/50">
                        <td className="px-6 py-3 text-slate-300">
                          {new Date(record.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-3">
                          <span className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-bold border',
                            ATTENDANCE_STATUS_COLORS[record.status] || 'bg-slate-700/50 text-slate-400 border-slate-600/30'
                          )}>
                            {ATTENDANCE_STATUS_LABELS[record.status] || record.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-slate-400 text-xs">
                          {record.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-6 text-center text-slate-500 text-sm">
                  No attendance records for this course yet
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}