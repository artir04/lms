import { useState } from 'react'
import { Calendar, BookOpen, Check, X, Clock, FileText, ChevronDown, ChevronRight } from 'lucide-react'
import { useMyAttendance } from '@/api/attendance'
import { PageLoader } from '@/components/ui/Spinner'
import { formatDate } from '@/utils/formatters'
import type { AttendanceStatus } from '@/types/attendance'

const STATUS_CONFIG: Record<AttendanceStatus, { icon: React.ReactNode; label: string; color: string }> = {
  present: { icon: <Check className="h-4 w-4" />, label: 'Present', color: 'bg-green-50 text-green-700 border-green-200' },
  absent: { icon: <X className="h-4 w-4" />, label: 'Absent', color: 'bg-red-50 text-red-700 border-red-200' },
  tardy: { icon: <Clock className="h-4 w-4" />, label: 'Tardy', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  excused: { icon: <FileText className="h-4 w-4" />, label: 'Excused', color: 'bg-slate-50 text-slate-700 border-slate-200' },
}

export function StudentAttendancePage() {
  const { data: attendanceData, isLoading } = useMyAttendance()
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set())

  const toggleCourse = (courseId: string) => {
    setExpandedCourses((prev) => {
      const next = new Set(prev)
      next.has(courseId) ? next.delete(courseId) : next.add(courseId)
      return next
    })
  }

  // Calculate overall stats
  const overallStats = attendanceData?.reduce(
    (acc, course) => {
      acc.total += course.attendance_records.length
      acc.present += course.attendance_records.filter((r) => r.status === 'present').length
      acc.absent += course.attendance_records.filter((r) => r.status === 'absent').length
      acc.tardy += course.attendance_records.filter((r) => r.status === 'tardy').length
      acc.excused += course.attendance_records.filter((r) => r.status === 'excused').length
      return acc
    },
    { total: 0, present: 0, absent: 0, tardy: 0, excused: 0 }
  ) || { total: 0, present: 0, absent: 0, tardy: 0, excused: 0 }

  const overallRate = overallStats.total > 0 ? Math.round((overallStats.present / overallStats.total) * 100) : 0

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">My Attendance</h1>
        <p className="text-sm text-slate-500">View your attendance record across all courses</p>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-white">{overallRate}%</p>
          <p className="text-xs text-slate-500 mt-1">Overall Rate</p>
        </div>
        <div className="card p-4 text-center bg-green-50">
          <p className="text-2xl font-bold text-green-700">{overallStats.present}</p>
          <p className="text-xs text-green-600 mt-1">Present</p>
        </div>
        <div className="card p-4 text-center bg-red-50">
          <p className="text-2xl font-bold text-red-700">{overallStats.absent}</p>
          <p className="text-xs text-red-600 mt-1">Absent</p>
        </div>
        <div className="card p-4 text-center bg-yellow-50">
          <p className="text-2xl font-bold text-yellow-700">{overallStats.tardy}</p>
          <p className="text-xs text-yellow-600 mt-1">Tardy</p>
        </div>
        <div className="card p-4 text-center bg-slate-50">
          <p className="text-2xl font-bold text-slate-700">{overallStats.excused}</p>
          <p className="text-xs text-slate-600 mt-1">Excused</p>
        </div>
      </div>

      {/* Course Attendance List */}
      {!attendanceData || attendanceData.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No attendance records found</p>
          <p className="text-sm mt-1">
            Once your teacher marks your attendance, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {attendanceData.map((course) => {
            const isExpanded = expandedCourses.has(course.course_id)
            const attendanceCount = course.attendance_records.length
            const presentCount = course.attendance_records.filter((r) => r.status === 'present').length
            const rate = attendanceCount > 0 ? Math.round((presentCount / attendanceCount) * 100) : 0

            return (
              <div key={course.course_id} className="card overflow-hidden">
                <button
                  onClick={() => toggleCourse(course.course_id)}
                  className="w-full flex items-center gap-4 p-5 hover:bg-slate-700/30 transition-colors text-left"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white">{course.course_title}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-slate-500">{attendanceCount} records</span>
                      <span className={`text-xs font-semibold ${rate >= 90 ? 'text-green-600' : rate >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {rate}% attendance rate
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    {/* Mini stats */}
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                        <Check className="h-3 w-3" />
                        {presentCount}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                        <X className="h-3 w-3" />
                        {course.attendance_records.filter((r) => r.status === 'absent').length}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-700/50 divide-y divide-slate-700/40">
                    {course.attendance_records.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-sm">
                        No attendance records yet
                      </div>
                    ) : (
                      course.attendance_records
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((record) => {
                          const config = STATUS_CONFIG[record.status as AttendanceStatus]
                          return (
                            <div key={record.id} className="p-4 flex items-center gap-4">
                              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${config.color}`}>
                                {config.icon}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-slate-100">{config.label}</p>
                                {record.notes && (
                                  <p className="text-sm text-slate-500 mt-0.5">{record.notes}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-white">{formatDate(record.date)}</p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  by {record.teacher.full_name}
                                </p>
                              </div>
                            </div>
                          )
                        })
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
