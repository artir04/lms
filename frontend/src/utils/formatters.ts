import { format, formatDistanceToNow } from 'date-fns'

export function formatDate(iso: string) {
  return format(new Date(iso), 'MMM d, yyyy')
}

export function formatDateTime(iso: string) {
  return format(new Date(iso), 'MMM d, yyyy h:mm a')
}

export function timeAgo(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true })
}

export function formatGrade(score: number | string | null | undefined): string {
  if (score === null || score === undefined) return '—'
  const n = typeof score === 'string' ? parseFloat(score) : score
  if (isNaN(n)) return '—'
  return n.toFixed(2)
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Kosovo grading system: 5 (highest) to 1 (lowest) */
export const NUMERIC_GRADE_COLORS: Record<number, string> = {
  5: 'badge-green',
  4: 'badge-blue',
  3: 'badge-yellow',
  2: 'badge-yellow',
  1: 'badge-red',
}
