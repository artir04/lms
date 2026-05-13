import { Link } from 'react-router-dom'
import { useParentChildren, useParentDigest } from '@/api/parents'
import { PageLoader } from '@/components/ui/Spinner'
import { Users, GraduationCap, CalendarCheck, Calendar } from 'lucide-react'
import { cn } from '@/utils/cn'
import { ROUTES } from '@/config/routes'

export function ParentDashboardPage() {
  const { data: children, isLoading } = useParentChildren()
  const { data: digest } = useParentDigest()

  if (isLoading) return <PageLoader />

  const gradeValues = (digest?.children ?? [])
    .map((c) => (c.overall_average !== null ? Number(c.overall_average) : null))
    .filter((v): v is number => v !== null)
  const averageGrade = gradeValues.length
    ? gradeValues.reduce((a, b) => a + b, 0) / gradeValues.length
    : null

  const attendanceValues = (digest?.children ?? [])
    .map((c) => (c.attendance_rate !== null ? Number(c.attendance_rate) : null))
    .filter((v): v is number => v !== null)
  const averageAttendance = attendanceValues.length
    ? attendanceValues.reduce((a, b) => a + b, 0) / attendanceValues.length
    : null

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div
        className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #4338ca 100%)' }}
      >
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-primary-500/15 blur-3xl pointer-events-none" />
        <div className="relative">
          <p className="text-primary-300 text-xs font-medium uppercase tracking-wider">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h2 className="text-2xl font-bold mt-1">Parent Portal</h2>
          <p className="text-slate-400 mt-1 text-sm">
            Monitor your children's academic progress and attendance
          </p>
        </div>
      </div>

      {/* Children count */}
      {children && children.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-600/20 flex items-center justify-center">
                <Users className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Children</p>
                <p className="text-lg font-bold text-white">{children.length}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Average Grade</p>
                <p className="text-lg font-bold text-white">
                  {averageGrade !== null ? (
                    <>
                      {averageGrade.toFixed(1)}
                      <span className="ml-1.5 text-xs font-medium text-slate-400">/ 5</span>
                    </>
                  ) : (
                    '—'
                  )}
                </p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-600/20 flex items-center justify-center">
                <CalendarCheck className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Attendance Rate</p>
                <p className="text-lg font-bold text-white">
                  {averageAttendance !== null ? `${averageAttendance.toFixed(0)}%` : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Children list */}
      <div>
        <h3 className="section-title mb-4">My Children</h3>

        {!children || children.length === 0 ? (
          <div className="card p-12 text-center text-slate-500">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>No children linked to your account</p>
            <p className="text-sm mt-2">Please contact your school administrator to link your children</p>
          </div>
        ) : (
          <div className="space-y-3">
            {children.map((child) => (
              <div
                key={child.student_id}
                className="card hover:border-primary-500/50 transition-all duration-200"
              >
                <div className="p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                      {child.student_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-white truncate">
                        {child.student_name}
                      </h4>
                      <p className="text-sm text-slate-400 truncate">{child.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded-full capitalize">
                          {child.relationship}
                        </span>
                        {child.is_primary_contact && (
                          <span className="text-xs bg-primary-600/20 text-primary-400 px-2 py-0.5 rounded-full">
                            Primary Contact
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to={ROUTES.PARENT_CHILD_GRADES(child.student_id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600/20 hover:border-emerald-500/40 transition-colors"
                    >
                      <GraduationCap className="h-3.5 w-3.5" />
                      Grades
                    </Link>
                    <Link
                      to={ROUTES.PARENT_CHILD_ATTENDANCE(child.student_id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600/10 text-amber-400 border border-amber-500/20 hover:bg-amber-600/20 hover:border-amber-500/40 transition-colors"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      Attendance
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}