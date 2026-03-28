import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { EngagementPoint } from '@/types/analytics'

interface EngagementChartProps {
  data: EngagementPoint[]
}

export function EngagementChart({ data }: EngagementChartProps) {
  return (
    <div className="card p-6">
      <h3 className="text-base font-semibold text-ink mb-4 font-display">Platform Engagement</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1c1f30" />
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#585a6e' }} tickFormatter={(v) => v.slice(5)} stroke="#1c1f30" />
          <YAxis tick={{ fontSize: 12, fill: '#585a6e' }} stroke="#1c1f30" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#181b24',
              border: '1px solid #282b40',
              borderRadius: '12px',
              color: '#e4e3ed',
              fontSize: '13px',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '12px', color: '#8b8da2' }} />
          <Line type="monotone" dataKey="logins" stroke="#60a5fa" strokeWidth={2} dot={false} name="Logins" />
          <Line type="monotone" dataKey="lesson_views" stroke="#34d399" strokeWidth={2} dot={false} name="Lesson Views" />
          <Line type="monotone" dataKey="submissions" stroke="#ed9338" strokeWidth={2} dot={false} name="Submissions" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
