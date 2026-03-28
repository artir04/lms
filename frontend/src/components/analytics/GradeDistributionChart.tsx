import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { GradeDistribution } from '@/types/analytics'

interface GradeDistributionChartProps {
  data: GradeDistribution
}

const GRADE_COLORS: Record<string, string> = {
  '5': '#34d399', '4': '#60a5fa', '3': '#fbbf24', '2': '#f97316', '1': '#f87171', 'N/A': '#585a6e',
}

export function GradeDistributionChart({ data }: GradeDistributionChartProps) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-ink font-display">Grade Distribution</h3>
        <span className="text-sm text-ink-secondary">Mean: {data.mean.toFixed(2)}</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data.buckets} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1c1f30" />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#585a6e' }} stroke="#1c1f30" />
          <YAxis tick={{ fontSize: 12, fill: '#585a6e' }} stroke="#1c1f30" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#181b24',
              border: '1px solid #282b40',
              borderRadius: '12px',
              color: '#e4e3ed',
              fontSize: '13px',
            }}
            formatter={(v, n) => [`${v} students`, n]}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {data.buckets.map((entry) => (
              <Cell key={entry.label} fill={GRADE_COLORS[entry.label] || '#585a6e'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
