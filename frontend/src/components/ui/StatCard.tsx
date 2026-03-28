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
  blue:    { icon: 'bg-blue-500/15    text-blue-400',    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.08)]' },
  indigo:  { icon: 'bg-indigo-500/15  text-indigo-400',  glow: 'shadow-[0_0_20px_rgba(99,102,241,0.08)]' },
  green:   { icon: 'bg-emerald-500/15 text-emerald-400', glow: 'shadow-[0_0_20px_rgba(16,185,129,0.08)]' },
  emerald: { icon: 'bg-emerald-500/15 text-emerald-400', glow: 'shadow-[0_0_20px_rgba(16,185,129,0.08)]' },
  yellow:  { icon: 'bg-amber-500/15   text-amber-400',   glow: 'shadow-[0_0_20px_rgba(245,158,11,0.08)]' },
  red:     { icon: 'bg-rose-500/15    text-rose-400',    glow: 'shadow-[0_0_20px_rgba(244,63,94,0.08)]' },
  purple:  { icon: 'bg-purple-500/15  text-purple-400',  glow: 'shadow-[0_0_20px_rgba(168,85,247,0.08)]' },
  sky:     { icon: 'bg-sky-500/15     text-sky-400',     glow: 'shadow-[0_0_20px_rgba(14,165,233,0.08)]' },
}

export function StatCard({ title, value, icon, trend, trendUp, color = 'indigo' }: StatCardProps) {
  const colors = colorMap[color]

  return (
    <div className={cn('card p-5 flex flex-col gap-3', colors.glow)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-ink-secondary uppercase tracking-wide">{title}</p>
          <p className="mt-2 text-3xl font-bold text-ink tabular-nums leading-none font-display">
            {value}
          </p>
        </div>
        <div className={cn('p-2.5 rounded-xl shrink-0', colors.icon)}>{icon}</div>
      </div>

      {trend && (
        <div
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium pt-2 border-t border-border/60',
            trendUp === undefined
              ? 'text-ink-muted'
              : trendUp
              ? 'text-emerald-400'
              : 'text-rose-400'
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
