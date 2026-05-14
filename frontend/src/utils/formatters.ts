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

/** Convert an HTML `<input type="datetime-local">` value (naive, local-zone) into an ISO 8601 UTC string the backend can parse. */
export function localDateTimeToIso(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const d = new Date(value)
  if (isNaN(d.getTime())) return undefined
  return d.toISOString()
}

/** Convert an ISO 8601 string into the value format expected by `<input type="datetime-local">` (YYYY-MM-DDTHH:mm, in the user's local zone). */
export function isoToLocalDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Kosovo grading system: 5 (highest) to 1 (lowest) */
export const NUMERIC_GRADE_COLORS: Record<number, string> = {
  5: 'badge-green',
  4: 'badge-blue',
  3: 'badge-yellow',
  2: 'badge-yellow',
  1: 'badge-red',
}
