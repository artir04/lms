import { useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { cn } from '@/utils/cn'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  loading?: boolean
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose()
    }
    if (isOpen) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose, loading])

  if (!isOpen) return null

  const isDanger = variant === 'danger'

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={() => !loading && onClose()}
      />

      <div className="relative w-full max-w-md bg-surface-elevated shadow-2xl animate-scale-in border border-border-strong rounded-t-2xl sm:rounded-2xl">
        <div className="flex items-start gap-4 p-6">
          <div
            className={cn(
              'shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
              isDanger
                ? 'bg-red-500/10 text-red-400 ring-1 ring-red-500/30'
                : 'bg-primary-500/10 text-primary-400 ring-1 ring-primary-500/30',
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-ink font-display leading-snug">{title}</h3>
            {description && (
              <p className="mt-1.5 text-sm text-ink-secondary leading-relaxed">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="shrink-0 p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-overlay transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-secondary flex-1"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed',
              isDanger
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_20px_-6px_rgba(239,68,68,0.6)]'
                : 'btn-primary',
            )}
          >
            {loading ? `${confirmLabel}…` : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
