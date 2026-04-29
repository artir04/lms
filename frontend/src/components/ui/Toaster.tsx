import { useEffect } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToastStore, type Toast, type ToastType } from '@/store/toastStore'
import { cn } from '@/utils/cn'

const TYPE_STYLES: Record<
  ToastType,
  { icon: React.ReactNode; ring: string; iconColor: string }
> = {
  success: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    ring: 'border-emerald-500/40 shadow-[0_0_30px_-12px_rgba(16,185,129,0.45)]',
    iconColor: 'text-emerald-400',
  },
  error: {
    icon: <XCircle className="h-5 w-5" />,
    ring: 'border-red-500/40 shadow-[0_0_30px_-12px_rgba(239,68,68,0.5)]',
    iconColor: 'text-red-400',
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5" />,
    ring: 'border-amber-500/40 shadow-[0_0_30px_-12px_rgba(245,158,11,0.45)]',
    iconColor: 'text-amber-400',
  },
  info: {
    icon: <Info className="h-5 w-5" />,
    ring: 'border-sky-500/40 shadow-[0_0_30px_-12px_rgba(56,189,248,0.45)]',
    iconColor: 'text-sky-400',
  },
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss)
  const styles = TYPE_STYLES[toast.type]

  useEffect(() => {
    if (toast.duration <= 0) return
    const timer = window.setTimeout(() => dismiss(toast.id), toast.duration)
    return () => window.clearTimeout(timer)
  }, [toast.id, toast.duration, dismiss])

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'pointer-events-auto w-full sm:w-[22rem] bg-surface-elevated border rounded-2xl px-4 py-3',
        'flex items-start gap-3 animate-fade-up backdrop-blur-sm',
        styles.ring,
      )}
    >
      <span className={cn('mt-0.5 shrink-0', styles.iconColor)}>{styles.icon}</span>
      <div className="flex-1 min-w-0">
        {toast.title ? (
          <p className="text-sm font-semibold text-ink leading-snug">{toast.title}</p>
        ) : null}
        <p className={cn('text-sm leading-snug whitespace-pre-line', toast.title ? 'text-ink-secondary mt-0.5' : 'text-ink')}>
          {toast.message}
        </p>
      </div>
      <button
        onClick={() => dismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-overlay transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 px-4 pb-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end sm:px-0 sm:pb-0"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
