import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { EngagementPoint } from '@/types/analytics'

interface EngagementChartProps {
  data: EngagementPoint[]
}

export function EngagementChart({ data }: EngagementChartProps) {
  return (
    <div className="card p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Platform Engagement</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => v.slice(5)} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="logins" stroke="#3b82f6" strokeWidth={2} dot={false} name="Logins" />
          <Line type="monotone" dataKey="lesson_views" stroke="#10b981" strokeWidth={2} dot={false} name="Lesson Views" />
          <Line type="monotone" dataKey="submissions" stroke="#f59e0b" strokeWidth={2} dot={false} name="Submissions" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
