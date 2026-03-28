import { useState } from 'react'
import { useParentDigest, useChildProgress } from '@/api/parents'
import { PageLoader } from '@/components/ui/Spinner'
import { Avatar } from '@/components/ui/Avatar'
import { formatGrade, formatDate } from '@/utils/formatters'
import { cn } from '@/utils/cn'
import {
  Users, BookOpen, TrendingUp, Calendar, ChevronRight, Clock,
  CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react'

const GRADE_COLORS: Record<number, string> = {
  5: 'text-emerald-400', 4: 'text-sky-400', 3: 'text-amber-400', 2: 'text-orange-400', 1: 'text-rose-400',
}

export function ParentDashboardPage() {
  const { data: digest, isLoading } = useParentDigest()
  const [selectedChildId, setSelectedChildId] = useState<string | undefined>()
  const { data: progress, isLoading: progressLoading } = useChildProgress(selectedChildId)

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-ink font-display">Parent Dashboard</h2>

      {!digest?.children.length ? (
        <div className="card p-12 text-center text-ink-muted">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No linked students yet. Contact your school administrator.</p>
        </div>
      ) : (
        <>
          {/* Children overview cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {digest.children.map((child) => (
              <button
                key={child.student.id}
                onClick={() => setSelectedChildId(child.student.id)}
                className={cn(
                  'card p-5 text-left transition-all hover:ring-2 hover:ring-primary-500/30',
                  selectedChildId === child.student.id && 'ring-2 ring-primary-500'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Avatar name={child.student.full_name} size="md" />
                  <div className="min-w-0">
                    <p className="font-semibold text-ink truncate">{child.student.full_name}</p>
                    <p className="text-xs text-ink-muted">{child.student.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-ink font-display">{child.course_count}</p>
                    <p className="text-[10px] text-ink-muted uppercase">Courses</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-ink font-display">
                      {child.overall_average != null ? formatGrade(child.overall_average) : '\u2014'}
                    </p>
                    <p className="text-[10px] text-ink-muted uppercase">Average</p>
                  </div>
                  <div>
                    <p className={cn('text-lg font-bold font-display', child.attendance_rate != null && child.attendance_rate >= 90 ? 'text-emerald-400' : child.attendance_rate != null && child.attendance_rate >= 75 ? 'text-amber-400' : 'text-rose-400')}>
                      {child.attendance_rate != null ? `${child.attendance_rate}%` : '\u2014'}
                    </p>
                    <p className="text-[10px] text-ink-muted uppercase">Attendance</p>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-1 mt-3 text-xs text-primary-400">
                  View details <ChevronRight className="w-3 h-3" />
                </div>
              </button>
            ))}
          </div>

          {/* Selected child detail */}
          {selectedChildId && (
            progressLoading ? <PageLoader /> : progress && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-ink font-display">{progress.student.full_name} — Detail View</h3>

                {/* Attendance summary */}
                <div className="card p-5">
                  <h4 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2 font-display">
                    <Calendar className="w-4 h-4 text-primary-400" /> Attendance Summary
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {[
                      { label: 'Total Days', value: progress.attendance_summary.total_days, icon: Calendar },
                      { label: 'Present', value: progress.attendance_summary.present, icon: CheckCircle2, color: 'text-emerald-400' },
                      { label: 'Absent', value: progress.attendance_summary.absent, icon: XCircle, color: 'text-rose-400' },
                      { label: 'Tardy', value: progress.attendance_summary.tardy, icon: AlertTriangle, color: 'text-amber-400' },
                      { label: 'Rate', value: `${progress.attendance_summary.attendance_rate}%`, icon: TrendingUp, color: progress.attendance_summary.attendance_rate >= 90 ? 'text-emerald-400' : 'text-amber-400' },
                    ].map((s) => (
                      <div key={s.label} className="text-center">
                        <s.icon className={cn('w-5 h-5 mx-auto mb-1', s.color || 'text-ink-muted')} />
                        <p className={cn('text-xl font-bold font-display', s.color || 'text-ink')}>{s.value}</p>
                        <p className="text-[10px] text-ink-muted uppercase">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Course progress */}
                <div className="card overflow-hidden">
                  <div className="px-5 py-3 border-b border-border">
                    <h4 className="text-sm font-semibold text-ink flex items-center gap-2 font-display">
                      <BookOpen className="w-4 h-4 text-primary-400" /> Course Grades
                    </h4>
                  </div>
                  {progress.courses.length === 0 ? (
                    <p className="px-5 py-8 text-center text-ink-muted text-sm">No course data yet</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-surface-elevated/50 text-left">
                          <th className="px-5 py-2 text-xs font-medium text-ink-muted uppercase">Course</th>
                          <th className="px-5 py-2 text-xs font-medium text-ink-muted uppercase text-center">Assignments</th>
                          <th className="px-5 py-2 text-xs font-medium text-ink-muted uppercase text-center">Average</th>
                          <th className="px-5 py-2 text-xs font-medium text-ink-muted uppercase text-center">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {progress.courses.map((c) => (
                          <tr key={c.course_id} className="hover:bg-surface-elevated/50">
                            <td className="px-5 py-3 text-ink font-medium">{c.course_title}</td>
                            <td className="px-5 py-3 text-center text-ink-secondary">{c.entry_count}</td>
                            <td className="px-5 py-3 text-center text-ink font-medium">
                              {c.weighted_average != null ? formatGrade(c.weighted_average) : '\u2014'}
                            </td>
                            <td className="px-5 py-3 text-center">
                              {c.final_grade != null ? (
                                <span className={cn('text-lg font-bold', GRADE_COLORS[c.final_grade] || 'text-ink-muted')}>
                                  {c.final_grade}
                                </span>
                              ) : '\u2014'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Upcoming assignments */}
                <div className="card overflow-hidden">
                  <div className="px-5 py-3 border-b border-border">
                    <h4 className="text-sm font-semibold text-ink flex items-center gap-2 font-display">
                      <Clock className="w-4 h-4 text-primary-400" /> Upcoming Assignments
                    </h4>
                  </div>
                  {progress.upcoming_assignments.length === 0 ? (
                    <p className="px-5 py-8 text-center text-ink-muted text-sm">No upcoming assignments</p>
                  ) : (
                    <div className="divide-y divide-border/60">
                      {progress.upcoming_assignments.map((item) => (
                        <div key={item.quiz_id} className="flex items-center justify-between px-5 py-3">
                          <div>
                            <p className="text-sm text-ink font-medium">{item.quiz_title}</p>
                            <p className="text-xs text-ink-muted">{item.course_title}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            {item.due_at && (
                              <span className="text-xs text-ink-muted">{formatDate(item.due_at)}</span>
                            )}
                            {item.is_submitted ? (
                              <span className="badge badge-green text-[10px]">Submitted</span>
                            ) : (
                              <span className="badge badge-yellow text-[10px]">Pending</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}
