import { useState } from 'react'
import { useDashboard, useEngagement } from '@/api/analytics'
import { StatCard } from '@/components/ui/StatCard'
import { EngagementChart } from '@/components/analytics/EngagementChart'
import { PageLoader } from '@/components/ui/Spinner'
import { Users, BookOpen, TrendingUp, Activity } from 'lucide-react'
import { formatGrade } from '@/utils/formatters'

export function AnalyticsPage() {
  const [days, setDays] = useState(30)
  const { data: dashboard, isLoading } = useDashboard()
  const { data: engagement } = useEngagement(days)

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Analytics</h2>
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
          <StatCard title="Total Students" value={dashboard.total_students} icon={<Users className="h-6 w-6" />} color="blue" />
          <StatCard title="Total Courses" value={dashboard.total_courses} icon={<BookOpen className="h-6 w-6" />} color="green" />
          <StatCard title="Average Grade" value={formatGrade(dashboard.avg_grade)} icon={<TrendingUp className="h-6 w-6" />} color="yellow" />
          <StatCard title="Active Today" value={dashboard.active_users_today} icon={<Activity className="h-6 w-6" />} color="red" />
        </div>
      )}

      {engagement && <EngagementChart data={engagement.points} />}
    </div>
  )
}
