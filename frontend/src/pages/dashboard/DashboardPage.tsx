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
    5: 'text-emerald-400',
    4: 'text-sky-400',
    3: 'text-amber-400',
    2: 'text-orange-400',
    1: 'text-rose-400',
  }

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div
        className="rounded-2xl p-6 sm:p-8 text-ink relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #111318 0%, #181b24 50%, #1a1208 100%)',
        }}
      >
        <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-primary-500/[0.08] blur-[80px] pointer-events-none" />
        <div className="absolute right-10 bottom-0 w-40 h-40 rounded-full bg-primary-500/[0.04] blur-[60px] pointer-events-none" />
        <div className="relative">
          <p className="text-primary-400 text-xs font-semibold uppercase tracking-widest font-display">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold mt-2 font-display">
            Welcome back, {user?.first_name ?? user?.full_name}
          </h2>
          <p className="text-ink-secondary mt-1.5 text-sm">
            {isStudent
              ? 'Keep up the great work on your courses!'
              : "Here's an overview of your platform today."}
          </p>
        </div>
      </div>

      {/* KPI stats — admin/teacher */}
      {(isAdmin || isTeacher) && dashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Students"
            value={dashboard.total_students}
            icon={<Users className="h-5 w-5" />}
            color="indigo"
            trend="+5% vs last month"
            trendUp={true}
          />
          <StatCard
            title="Active Courses"
            value={dashboard.total_courses}
            icon={<BookOpen className="h-5 w-5" />}
            color="emerald"
          />
          <StatCard
            title="Average Grade"
            value={formatGrade(dashboard.avg_grade)}
            icon={<TrendingUp className="h-5 w-5" />}
            color="yellow"
            trend="Across all courses"
          />
          <StatCard
            title="Active Today"
            value={dashboard.active_users_today}
            icon={<Activity className="h-5 w-5" />}
            color="sky"
            trend="+12% vs yesterday"
            trendUp={true}
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
              className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1 font-medium transition-colors"
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
              <Clock className="w-4 h-4 text-primary-400" /> What's Due Next
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
                        'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                        item.is_overdue
                          ? 'bg-rose-500/15'
                          : 'bg-primary-500/15'
                      )}
                    >
                      {item.is_overdue ? (
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-primary-400" />
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
                          'text-xs',
                          item.is_overdue ? 'text-red-400' : 'text-ink-muted'
                        )}
                      >
                        {item.is_overdue ? 'Overdue' : formatDate(item.due_at)}
                      </span>
                    )}
                    <span className="text-[10px] text-ink-muted">
                      {item.attempts_used}/{item.max_attempts} attempts
                    </span>
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
              <h3 className="font-semibold text-ink text-sm font-display">Platform Engagement</h3>
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
              className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1 font-medium transition-colors"
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
