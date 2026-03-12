import { Users, BookOpen, TrendingUp, Activity } from 'lucide-react'
import { useDashboard, useEngagement } from '@/api/analytics'
import { useCourses } from '@/api/courses'
import { useMyGrades } from '@/api/grades'
import { useAuth } from '@/hooks/useAuth'
import { StatCard } from '@/components/ui/StatCard'
import { CourseCard } from '@/components/course/CourseCard'
import { EngagementChart } from '@/components/analytics/EngagementChart'
import { PageLoader } from '@/components/ui/Spinner'
import { formatGrade } from '@/utils/formatters'

export function DashboardPage() {
  const { isStudent, isTeacher, isAdmin, user } = useAuth()
  const { data: dashboard, isLoading: dashLoading } = useDashboard()
  const { data: coursesData, isLoading: coursesLoading } = useCourses({ page_size: 6 })
  const { data: engagement } = useEngagement(14)
  const { data: myGrades } = useMyGrades()

  if (dashLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.first_name}!
        </h2>
        <p className="text-gray-500 mt-1">Here's what's happening on your platform.</p>
      </div>

      {/* Stats */}
      {(isAdmin || isTeacher) && dashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title="Total Students"
            value={dashboard.total_students}
            icon={<Users className="h-6 w-6" />}
            color="blue"
          />
          <StatCard
            title="Active Courses"
            value={dashboard.total_courses}
            icon={<BookOpen className="h-6 w-6" />}
            color="green"
          />
          <StatCard
            title="Average Grade"
            value={formatGrade(dashboard.avg_grade)}
            icon={<TrendingUp className="h-6 w-6" />}
            color="yellow"
          />
          <StatCard
            title="Active Today"
            value={dashboard.active_users_today}
            icon={<Activity className="h-6 w-6" />}
            color="red"
          />
        </div>
      )}

      {/* Student grade summary */}
      {isStudent && myGrades && myGrades.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {myGrades.slice(0, 3).map((g) => (
            <div key={g.course_id} className="card p-4">
              <p className="text-sm font-medium text-gray-700 line-clamp-1">{g.course_title}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-2xl font-bold text-gray-900">{formatGrade(g.average)}</span>
                {g.letter_grade && (
                  <span className={`badge ${g.letter_grade === 'A' ? 'badge-green' : g.letter_grade === 'F' ? 'badge-red' : 'badge-blue'}`}>
                    {g.letter_grade}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Engagement Chart */}
      {(isAdmin || isTeacher) && engagement && (
        <EngagementChart data={engagement.points} />
      )}

      {/* Recent Courses */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {isStudent ? 'My Courses' : 'Recent Courses'}
          </h3>
        </div>
        {coursesLoading ? (
          <PageLoader />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {coursesData?.items.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
            {!coursesData?.items.length && (
              <p className="text-gray-500 col-span-3 text-center py-12">No courses yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
