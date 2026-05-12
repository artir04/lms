import { useState } from 'react'
import { Users, BookOpen, TrendingUp, Activity, ArrowRight, Clock, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useDashboard, useEngagement } from '@/api/analytics'
import { useCourses } from '@/api/courses'
import { useMyGrades } from '@/api/grades'
import { useUpcoming } from '@/api/gamification'
import { useAuth } from '@/hooks/useAuth'
import { StatCard } from '@/components/ui/StatCard'
import { CourseCard } from '@/components/course/CourseCard'
import { EngagementChart } from '@/components/analytics/EngagementChart'
import { PageLoader } from '@/components/ui/Spinner'
import { formatGrade, formatDate } from '@/utils/formatters'
import { ROUTES } from '@/config/routes'
import { cn } from '@/utils/cn'

export function DashboardPage() {
  const [engagementDays, setEngagementDays] = useState(14)
  const { isStudent, isTeacher, isAdmin, user } = useAuth()
  const { data: dashboard, isLoading: dashLoading } = useDashboard()
  const { data: coursesData, isLoading: coursesLoading } = useCourses({ page_size: 6 })
  const { data: engagement } = useEngagement(engagementDays)
  const { data: myGrades } = useMyGrades()
  const { data: upcoming } = useUpcoming()

  if (dashLoading) return <PageLoader />

  const GRADE_COLORS: Record<number, string> = {
    5: 'text-emerald-600 dark:text-emerald-400',
    4: 'text-sky-600 dark:text-sky-400',
    3: 'text-amber-600 dark:text-amber-400',
    2: 'text-orange-600 dark:text-orange-400',
    1: 'text-rose-600 dark:text-rose-400',
  }

  return (
    <div className="space-y-6">
      {/* Welcome banner — editorial paper / dusk-navy */}
      <div
        className="rounded-3xl p-6 sm:p-9 text-ink relative overflow-hidden border border-border
          bg-gradient-to-br from-amber-50 via-orange-50/60 to-rose-50
          dark:bg-none dark:bg-[linear-gradient(135deg,#111318_0%,#181b24_50%,#1a1208_100%)] dark:border-transparent"
      >
        {/* Atmospheric glows */}
        <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-primary-400/25 blur-[90px] pointer-events-none dark:bg-primary-500/[0.08]" />
        <div className="absolute right-16 bottom-0 w-44 h-44 rounded-full bg-rose-300/20 blur-[70px] pointer-events-none dark:bg-primary-500/[0.04]" />
        <div className="absolute -left-12 -bottom-12 w-56 h-56 rounded-full bg-amber-200/30 blur-[80px] pointer-events-none dark:hidden" />

        {/* Decorative monogram (light only) */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[180px] font-black leading-none text-primary-500/[0.05] select-none font-display tracking-tighter dark:hidden">
          ✦
        </div>

        <div className="relative">
          <p className="text-primary-700 dark:text-primary-400 text-[11px] font-bold uppercase tracking-[0.22em] font-display flex items-center gap-2">
            <span className="inline-block w-6 h-px bg-primary-500/60" />
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h2 className="text-3xl sm:text-[2.5rem] font-bold mt-3 font-display tracking-tight leading-[1.05]">
            Welcome back,{' '}
            <span className="bg-gradient-to-r from-primary-600 to-rose-600 dark:from-primary-300 dark:to-primary-500 bg-clip-text text-transparent">
              {user?.first_name ?? user?.full_name}
            </span>
          </h2>
          <p className="text-ink-secondary mt-3 text-[15px] max-w-xl leading-relaxed">
            {isStudent
              ? 'Keep up the great work on your courses — your next lesson is waiting.'
              : isAdmin
                ? "Here's an overview of your platform today."
                : "Here's an overview of your classes today."}
          </p>
        </div>
      </div>

      {/* KPI stats — admin/teacher (teacher sees own-courses scope; admin sees tenant scope) */}
      {(isAdmin || isTeacher) && dashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title={isAdmin ? 'Total Students' : 'My Students'}
            value={dashboard.total_students}
            icon={<Users className="h-5 w-5" />}
            color="indigo"
          />
          <StatCard
            title={isAdmin ? 'Active Courses' : 'My Courses'}
            value={dashboard.total_courses}
            icon={<BookOpen className="h-5 w-5" />}
            color="emerald"
          />
          <StatCard
            title="Average Grade"
            value={formatGrade(dashboard.avg_grade)}
            icon={<TrendingUp className="h-5 w-5" />}
            color="yellow"
            trend={isAdmin ? 'Across all courses' : 'Across your courses'}
          />
          <StatCard
            title="Active Today"
            value={dashboard.active_users_today}
            icon={<Activity className="h-5 w-5" />}
            color="sky"
          />
        </div>
      )}

      {/* Student grade cards */}
      {isStudent && myGrades && myGrades.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-title mb-0">My Grades</h3>
            <Link
              to={ROUTES.MY_GRADES}
              className="text-sm text-primary-700 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 flex items-center gap-1 font-medium transition-colors group/link"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {myGrades.slice(0, 4).map((g) => (
              <div key={g.course_id} className="card p-4">
                <p className="text-xs text-ink-muted truncate font-medium leading-tight">
                  {g.course_title}
                </p>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-bold text-ink tabular-nums font-display">
                    {formatGrade(g.weighted_average)}
                  </span>
                  {g.final_grade != null && (
                    <span
                      className={cn(
                        'text-sm font-bold',
                        GRADE_COLORS[g.final_grade] ?? 'text-ink-muted'
                      )}
                    >
                      {g.final_grade}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What's Due Next — students */}
      {isStudent && upcoming && upcoming.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-title mb-0 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary-600 dark:text-primary-400" /> What's Due Next
            </h3>
          </div>
          <div className="card overflow-hidden">
            <div className="divide-y divide-border">
              {upcoming.slice(0, 5).map((item) => (
                <Link
                  key={item.quiz_id}
                  to={
                    item.attempts_used < item.max_attempts
                      ? ROUTES.QUIZ_TAKE(item.quiz_id)
                      : ROUTES.COURSE_DETAIL(item.course_id)
                  }
                  className="flex items-center justify-between px-5 py-3 hover:bg-surface-elevated transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-1',
                        item.is_overdue
                          ? 'bg-rose-100 ring-rose-200/70 dark:bg-rose-500/15 dark:ring-rose-500/20'
                          : 'bg-primary-100 ring-primary-200/70 dark:bg-primary-500/15 dark:ring-primary-500/20'
                      )}
                    >
                      {item.is_overdue ? (
                        <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-primary-700 dark:text-primary-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">
                        {item.quiz_title}
                      </p>
                      <p className="text-xs text-ink-muted truncate">
                        {item.course_title}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {item.due_at && (
                      <span
                        className={cn(
                          'text-xs font-medium',
                          item.is_overdue
                            ? 'text-rose-600 dark:text-red-400'
                            : 'text-ink-muted'
                        )}
                      >
                        {item.is_overdue ? 'Overdue' : formatDate(item.due_at)}
                      </span>
                    )}
                    <ArrowRight className="w-3.5 h-3.5 text-ink-faint" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Engagement chart + course grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {(isAdmin || isTeacher) && (
          <div className="xl:col-span-2 card">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold text-ink text-sm font-display">
                {isAdmin ? 'Platform Engagement' : 'Class Engagement'}
              </h3>
              <div className="flex gap-1">
                {[7, 14, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => setEngagementDays(d)}
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-lg transition-colors',
                      engagementDays === d
                        ? 'bg-primary-500 text-white'
                        : 'text-ink-muted hover:bg-surface-elevated'
                    )}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4">
              {engagement ? (
                <EngagementChart data={engagement.points} />
              ) : (
                <div className="h-48 flex items-center justify-center">
                  <PageLoader />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent courses */}
        <div className={cn(isStudent ? 'xl:col-span-3' : 'xl:col-span-1')}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-title mb-0">
              {isStudent ? 'My Courses' : 'Recent Courses'}
            </h3>
            <Link
              to={ROUTES.COURSES}
              className="text-sm text-primary-700 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 flex items-center gap-1 font-medium transition-colors group/link"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {coursesLoading ? (
            <PageLoader />
          ) : (
            <div
              className={cn(
                'grid gap-4',
                isStudent
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                  : 'grid-cols-1'
              )}
            >
              {coursesData?.items.slice(0, isStudent ? 8 : 4).map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
              {!coursesData?.items.length && (
                <p className="text-ink-muted text-sm py-8 text-center col-span-full">
                  No courses yet.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
