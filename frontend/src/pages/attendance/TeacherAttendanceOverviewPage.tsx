import { Link } from 'react-router-dom'
import { Calendar, CheckCircle2, AlertCircle, ArrowRight, Users } from 'lucide-react'
import { useTeacherAttendanceOverview } from '@/api/teacher'
import { PageLoader } from '@/components/ui/Spinner'
import { ROUTES } from '@/config/routes'
import { cn } from '@/utils/cn'

export function TeacherAttendanceOverviewPage() {
  const { data, isLoading } = useTeacherAttendanceOverview()

  if (isLoading || !data) return <PageLoader />

  const totalCourses = data.courses.length
  const markedToday = data.courses.filter((c) => c.marked_today).length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-ink font-display">Attendance Overview</h2>
        <p className="text-sm text-ink-muted mt-1">
          Across the courses you teach · {data.date} · {markedToday} of {totalCourses} marked today
        </p>
      </div>

      {data.courses.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-ink-muted text-sm">You don't teach any courses yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.courses.map((c) => {
            const total = c.today_present + c.today_absent + c.today_tardy + c.today_excused
            const presentRate = total > 0 ? Math.round((c.today_present / total) * 100) : null
            return (
              <Link
                key={c.course_id}
                to={ROUTES.COURSE_ATTENDANCE(c.course_id)}
                className="card p-5 hover:border-primary-500/40 transition-colors group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Calendar className="w-4 h-4 text-primary-400 shrink-0" />
                    <h3 className="font-semibold text-ink truncate">{c.course_title}</h3>
                  </div>
                  <span
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0',
                      c.marked_today
                        ? 'text-emerald-300 bg-emerald-500/15'
                        : 'text-amber-300 bg-amber-500/15'
                    )}
                  >
                    {c.marked_today ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> marked
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> pending
                      </span>
                    )}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
                  <Users className="w-3.5 h-3.5" />
                  {c.student_count} student{c.student_count === 1 ? '' : 's'} enrolled
                </div>

                {c.marked_today && total > 0 && (
                  <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-lg font-semibold text-emerald-400 tabular-nums">
                        {c.today_present}
                      </p>
                      <p className="text-[10px] text-ink-muted uppercase tracking-wider">Present</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-rose-400 tabular-nums">
                        {c.today_absent}
                      </p>
                      <p className="text-[10px] text-ink-muted uppercase tracking-wider">Absent</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-amber-400 tabular-nums">
                        {c.today_tardy}
                      </p>
                      <p className="text-[10px] text-ink-muted uppercase tracking-wider">Tardy</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-sky-400 tabular-nums">
                        {c.today_excused}
                      </p>
                      <p className="text-[10px] text-ink-muted uppercase tracking-wider">Excused</p>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between text-xs">
                  {presentRate != null ? (
                    <span className="text-ink-muted">
                      Present rate today:{' '}
                      <span
                        className={cn(
                          'font-semibold tabular-nums',
                          presentRate >= 90
                            ? 'text-emerald-400'
                            : presentRate >= 75
                              ? 'text-amber-400'
                              : 'text-rose-400'
                        )}
                      >
                        {presentRate}%
                      </span>
                    </span>
                  ) : (
                    <span className="text-ink-muted">Not yet recorded</span>
                  )}
                  <span className="text-primary-400 group-hover:text-primary-300 flex items-center gap-1">
                    Mark <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
