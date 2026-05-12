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
  blue: {
    icon: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200/70 dark:bg-blue-500/15 dark:text-blue-400 dark:ring-0',
    bar:  'from-blue-400 to-blue-600',
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.08)]',
  },
  indigo: {
    icon: 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200/70 dark:bg-indigo-500/15 dark:text-indigo-400 dark:ring-0',
    bar:  'from-indigo-400 to-indigo-600',
    glow: 'shadow-[0_0_20px_rgba(99,102,241,0.08)]',
  },
  green: {
    icon: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/70 dark:bg-emerald-500/15 dark:text-emerald-400 dark:ring-0',
    bar:  'from-emerald-400 to-emerald-600',
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.08)]',
  },
  emerald: {
    icon: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/70 dark:bg-emerald-500/15 dark:text-emerald-400 dark:ring-0',
    bar:  'from-emerald-400 to-emerald-600',
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.08)]',
  },
  yellow: {
    icon: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200/70 dark:bg-amber-500/15 dark:text-amber-400 dark:ring-0',
    bar:  'from-amber-400 to-amber-600',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.08)]',
  },
  red: {
    icon: 'bg-rose-100 text-rose-700 ring-1 ring-rose-200/70 dark:bg-rose-500/15 dark:text-rose-400 dark:ring-0',
    bar:  'from-rose-400 to-rose-600',
    glow: 'shadow-[0_0_20px_rgba(244,63,94,0.08)]',
  },
  purple: {
    icon: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200/70 dark:bg-purple-500/15 dark:text-purple-400 dark:ring-0',
    bar:  'from-purple-400 to-purple-600',
    glow: 'shadow-[0_0_20px_rgba(168,85,247,0.08)]',
  },
  sky: {
    icon: 'bg-sky-100 text-sky-700 ring-1 ring-sky-200/70 dark:bg-sky-500/15 dark:text-sky-400 dark:ring-0',
    bar:  'from-sky-400 to-sky-600',
    glow: 'shadow-[0_0_20px_rgba(14,165,233,0.08)]',
  },
}

export function StatCard({ title, value, icon, trend, trendUp, color = 'indigo' }: StatCardProps) {
  const colors = colorMap[color]

  return (
    <div className={cn('card p-5 flex flex-col gap-3 relative overflow-hidden group/stat', colors.glow)}>
      {/* Accent rule */}
      <span
        aria-hidden
        className={cn(
          'absolute top-0 left-5 right-5 h-px bg-gradient-to-r opacity-50 group-hover/stat:opacity-100 transition-opacity',
          colors.bar
        )}
      />

      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-ink-muted uppercase tracking-[0.18em]">{title}</p>
          <p className="mt-2.5 text-[2rem] font-bold text-ink tabular-nums leading-none font-display tracking-tight">
            {value}
          </p>
        </div>
        <div className={cn('p-2.5 rounded-xl shrink-0', colors.icon)}>{icon}</div>
      </div>

      {trend && (
        <div
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium pt-2.5 border-t border-border/70',
            trendUp === undefined
              ? 'text-ink-muted'
              : trendUp
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'
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
