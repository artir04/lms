import { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/utils/cn'

interface StatCardProps {
  title: string
  value: string | number
  icon: ReactNode
  trend?: string
  trendUp?: boolean
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'indigo' | 'purple' | 'sky' | 'emerald'
}

const colorMap = {
  blue:    { icon: 'bg-blue-50    text-blue-600',    bar: 'bg-blue-500' },
  indigo:  { icon: 'bg-indigo-50  text-indigo-600',  bar: 'bg-indigo-500' },
  green:   { icon: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500' },
  emerald: { icon: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500' },
  yellow:  { icon: 'bg-amber-50   text-amber-600',   bar: 'bg-amber-500' },
  red:     { icon: 'bg-rose-50    text-rose-600',    bar: 'bg-rose-500' },
  purple:  { icon: 'bg-purple-50  text-purple-600',  bar: 'bg-purple-500' },
  sky:     { icon: 'bg-sky-50     text-sky-600',     bar: 'bg-sky-500' },
}

export function StatCard({ title, value, icon, trend, trendUp, color = 'indigo' }: StatCardProps) {
  const colors = colorMap[color]

  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 tabular-nums leading-none">
            {value}
          </p>
        </div>
        <div className={cn('p-2.5 rounded-xl shrink-0', colors.icon)}>{icon}</div>
      </div>

      {trend && (
        <div
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium pt-2 border-t border-slate-50',
            trendUp === undefined
              ? 'text-slate-400'
              : trendUp
              ? 'text-emerald-600'
              : 'text-rose-500'
          )}
        >
          {trendUp !== undefined &&
            (trendUp ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            ))}
          <span>{trend}</span>
        </div>
      )}
    </div>
  )
}
