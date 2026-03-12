import { useState } from 'react'
import { Users, BookOpen, TrendingUp, Activity, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useDashboard, useEngagement } from '@/api/analytics'
import { useCourses } from '@/api/courses'
import { useMyGrades } from '@/api/grades'
import { useAuth } from '@/hooks/useAuth'
import { StatCard } from '@/components/ui/StatCard'
import { CourseCard } from '@/components/course/CourseCard'
import { EngagementChart } from '@/components/analytics/EngagementChart'
import { PageLoader } from '@/components/ui/Spinner'
import { formatGrade } from '@/utils/formatters'
import { ROUTES } from '@/config/routes'
import { cn } from '@/utils/cn'

export function DashboardPage() {
  const [engagementDays, setEngagementDays] = useState(14)
  const { isStudent, isTeacher, isAdmin, user } = useAuth()
  const { data: dashboard, isLoading: dashLoading } = useDashboard()
  const { data: coursesData, isLoading: coursesLoading } = useCourses({ page_size: 6 })
  const { data: engagement } = useEngagement(engagementDays)
  const { data: myGrades } = useMyGrades()

  if (dashLoading) return <PageLoader />

  const GRADE_COLORS: Record<string, string> = {
    A: 'text-emerald-600',
    B: 'text-sky-600',
    C: 'text-amber-600',
    D: 'text-orange-600',
    F: 'text-rose-600',
  }

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
          <h2 className="text-2xl font-bold mt-1">
            Welcome back, {user?.first_name ?? user?.full_name} 👋
          </h2>
          <p className="text-slate-400 mt-1 text-sm">
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
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {myGrades.slice(0, 4).map((g) => (
              <div key={g.course_id} className="card p-4">
                <p className="text-xs text-slate-500 truncate font-medium leading-tight">
                  {g.course_title}
                </p>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-bold text-slate-900 tabular-nums">
                    {formatGrade(g.average)}
                  </span>
                  {g.letter_grade && (
                    <span
                      className={cn(
                        'text-sm font-bold',
                        GRADE_COLORS[g.letter_grade] ?? 'text-slate-500'
                      )}
                    >
                      {g.letter_grade}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Engagement chart + course grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {(isAdmin || isTeacher) && (
          <div className="xl:col-span-2 card">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 text-sm">Platform Engagement</h3>
              <div className="flex gap-1">
                {[7, 14, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => setEngagementDays(d)}
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-lg transition-colors',
                      engagementDays === d
                        ? 'bg-primary-600 text-white'
                        : 'text-slate-500 hover:bg-slate-100'
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
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium"
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
                <p className="text-slate-400 text-sm py-8 text-center col-span-full">
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
