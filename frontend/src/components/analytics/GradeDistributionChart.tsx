import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { GradeDistribution } from '@/types/analytics'

interface GradeDistributionChartProps {
  data: GradeDistribution
}

const GRADE_COLORS: Record<string, string> = {
  A: '#10b981', B: '#3b82f6', C: '#f59e0b', D: '#f97316', F: '#ef4444', 'N/A': '#6b7280',
}

export function GradeDistributionChart({ data }: GradeDistributionChartProps) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900">Grade Distribution</h3>
        <span className="text-sm text-gray-500">Mean: {data.mean.toFixed(1)}%</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data.buckets} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v, n) => [`${v} students`, n]} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.buckets.map((entry) => (
              <Cell key={entry.label} fill={GRADE_COLORS[entry.label] || '#6b7280'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
