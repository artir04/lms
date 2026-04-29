import { useState } from 'react'
import { useDashboard, useEngagement } from '@/api/analytics'
import { useAuth } from '@/hooks/useAuth'
import { StatCard } from '@/components/ui/StatCard'
import { EngagementChart } from '@/components/analytics/EngagementChart'
import { PageLoader } from '@/components/ui/Spinner'
import { Users, BookOpen, TrendingUp, Activity } from 'lucide-react'
import { formatGrade } from '@/utils/formatters'

export function AnalyticsPage() {
  const [days, setDays] = useState(30)
  const { isAdmin } = useAuth()
  const { data: dashboard, isLoading } = useDashboard()
  const { data: engagement } = useEngagement(days)

  if (isLoading) return <PageLoader />

  const scopeLabel = isAdmin ? 'Platform' : 'Class'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink font-display">Analytics</h2>
          {!isAdmin && (
            <p className="text-sm text-ink-muted mt-1">
              Showing engagement and activity for the courses you teach.
            </p>
          )}
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="input w-auto"
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {dashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title={isAdmin ? 'Total Students' : 'My Students'} value={dashboard.total_students} icon={<Users className="h-6 w-6" />} color="blue" />
          <StatCard title={isAdmin ? 'Total Courses' : 'My Courses'} value={dashboard.total_courses} icon={<BookOpen className="h-6 w-6" />} color="green" />
          <StatCard title="Average Grade" value={formatGrade(dashboard.avg_grade)} icon={<TrendingUp className="h-6 w-6" />} color="yellow" />
          <StatCard title="Active Today" value={dashboard.active_users_today} icon={<Activity className="h-6 w-6" />} color="red" />
        </div>
      )}

      {engagement && (
        <div>
          <h3 className="text-sm font-semibold text-ink mb-3 font-display">{scopeLabel} Engagement</h3>
          <EngagementChart data={engagement.points} />
        </div>
      )}
    </div>
  )
}
