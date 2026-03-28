import { cn } from '@/utils/cn'

interface AvatarProps {
  src?: string | null
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
}

const BG_COLORS = [
  'bg-violet-500/80',
  'bg-indigo-500/80',
  'bg-sky-500/80',
  'bg-emerald-500/80',
  'bg-amber-500/80',
  'bg-rose-500/80',
  'bg-teal-500/80',
  'bg-purple-500/80',
  'bg-cyan-500/80',
  'bg-pink-500/80',
]

function colorFromName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % BG_COLORS.length
  return BG_COLORS[Math.abs(hash)]
}

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover ring-2 ring-surface-elevated', sizes[size], className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold text-white ring-2 ring-surface-elevated',
        sizes[size],
        colorFromName(name),
        className
      )}
    >
      {initials}
    </div>
  )
}
