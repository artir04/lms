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
  const n = Number(score)
  if (isNaN(n)) return '—'
  return `${n.toFixed(1)}%`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const LETTER_GRADE_COLORS: Record<string, string> = {
  A: 'badge-green',
  B: 'badge-blue',
  C: 'badge-yellow',
  D: 'badge-yellow',
  F: 'badge-red',
}
