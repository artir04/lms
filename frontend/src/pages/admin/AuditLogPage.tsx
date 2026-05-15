import { Fragment, useMemo, useState } from 'react'
import {
  Activity,
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  Filter,
  RotateCcw,
  Search,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react'

import { PageLoader } from '@/components/ui/Spinner'
import { useDebounce } from '@/hooks/useDebounce'
import {
  AuditCourseRef,
  AuditEntry,
  AuditSectionRef,
  useAuditLogs,
} from '@/api/audit'
import { formatDateTime, timeAgo } from '@/utils/formatters'

interface ActionGroup {
  key: string
  label: string
  prefix: string
  color: string
}

const ACTION_GROUPS: ActionGroup[] = [
  { key: 'user', label: 'Users', prefix: 'user.', color: 'badge-blue' },
  { key: 'course', label: 'Courses', prefix: 'course.', color: 'badge-green' },
  { key: 'enrollment', label: 'Enrollments', prefix: 'enrollment.', color: 'badge-purple' },
  { key: 'parent_link', label: 'Parent links', prefix: 'parent_link.', color: 'badge-yellow' },
  { key: 'school', label: 'Schools', prefix: 'school.', color: 'badge-blue' },
  { key: 'tenant', label: 'Tenant', prefix: 'tenant.', color: 'badge-gray' },
]

const TARGET_TYPES: { value: string; label: string }[] = [
  { value: 'user', label: 'User' },
  { value: 'course', label: 'Course' },
  { value: 'section', label: 'Section' },
  { value: 'enrollment', label: 'Enrollment' },
  { value: 'school', label: 'School' },
  { value: 'tenant', label: 'Tenant' },
  { value: 'parent_student', label: 'Parent link' },
]

const ACTION_BADGE: Record<string, string> = {
  'user.create': 'badge-green',
  'user.update': 'badge-blue',
  'user.delete': 'badge-red',
  'user.deactivate': 'badge-red',
  'course.create': 'badge-green',
  'course.update': 'badge-blue',
  'course.publish_toggle': 'badge-blue',
  'course.archive': 'badge-yellow',
  'course.unarchive': 'badge-green',
  'course.reassign_teacher': 'badge-blue',
  'enrollment.create': 'badge-green',
  'enrollment.drop': 'badge-red',
  'enrollment.transfer': 'badge-blue',
  'enrollment.csv_import': 'badge-purple',
  'parent_link.create': 'badge-green',
  'parent_link.delete': 'badge-red',
  'school.create': 'badge-green',
  'school.update': 'badge-blue',
  'school.deactivate': 'badge-red',
  'tenant.settings.update': 'badge-blue',
}

const ROLE_BADGE: Record<string, string> = {
  superadmin: 'badge-purple',
  admin: 'badge-blue',
  teacher: 'badge-green',
  student: 'badge-gray',
  parent: 'badge-yellow',
}

const PAGE_SIZE = 25

function formatPlace(
  course: AuditCourseRef | { title?: string | null } | null,
  section: AuditSectionRef | { name?: string | null } | null,
): string {
  const parts: string[] = []
  const cTitle = (course as { title?: string | null } | null)?.title
  const sName = (section as { name?: string | null } | null)?.name
  if (cTitle) parts.push(cTitle)
  if (sName) parts.push(`§ ${sName}`)
  return parts.join(' · ')
}

function describeSubject(entry: AuditEntry): { primary: string; secondary?: string } | null {
  if (entry.target?.label) {
    return { primary: entry.target.label, secondary: entry.target.sublabel ?? undefined }
  }
  if (entry.student) {
    return { primary: entry.student.full_name, secondary: entry.student.email }
  }
  if (entry.subject_user) {
    return { primary: entry.subject_user.full_name, secondary: entry.subject_user.email }
  }
  if (entry.section || entry.course) {
    const place = formatPlace(entry.course, entry.section)
    if (place) return { primary: place }
  }
  if (entry.students && entry.students.length > 0) {
    const first = entry.students[0]
    return {
      primary: first.full_name,
      secondary:
        entry.students.length > 1
          ? `${first.email} · +${entry.students.length - 1} more`
          : first.email,
    }
  }
  if (entry.target?.id) {
    return { primary: entry.target_type ?? 'item', secondary: entry.target.id }
  }
  return null
}

function exportAuditCsv(rows: AuditEntry[]) {
  const headers = [
    'when',
    'action',
    'actor_email',
    'actor_role',
    'target_type',
    'subject',
    'subject_detail',
    'summary',
    'ip_address',
    'user_agent',
  ]
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.join(',')]
  for (const e of rows) {
    const subj = describeSubject(e)
    lines.push(
      [
        e.created_at,
        e.action,
        e.actor_email,
        e.actor_role,
        e.target_type,
        subj?.primary ?? '',
        subj?.secondary ?? '',
        e.summary,
        e.ip_address,
        e.user_agent,
      ]
        .map(escape)
        .join(','),
    )
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function AuditLogPage() {
  const [search, setSearch] = useState('')
  const [groupKeys, setGroupKeys] = useState<string[]>([])
  const [targetTypes, setTargetTypes] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const debounced = useDebounce(search)

  const action_prefixes = useMemo(() => {
    if (groupKeys.length === 0) return undefined
    return ACTION_GROUPS.filter((g) => groupKeys.includes(g.key)).map((g) => g.prefix)
  }, [groupKeys])

  const { data, isLoading, isFetching } = useAuditLogs({
    page,
    page_size: PAGE_SIZE,
    search: debounced || undefined,
    action_prefixes,
    target_types: targetTypes.length > 0 ? targetTypes : undefined,
    date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
    date_to: dateTo ? new Date(dateTo).toISOString() : undefined,
  })

  const toggleGroup = (key: string) => {
    setPage(1)
    setGroupKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const toggleTarget = (tt: string) => {
    setPage(1)
    setTargetTypes((prev) => (prev.includes(tt) ? prev.filter((t) => t !== tt) : [...prev, tt]))
  }

  const resetFilters = () => {
    setSearch('')
    setGroupKeys([])
    setTargetTypes([])
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const activeFilterCount =
    (debounced ? 1 : 0) +
    groupKeys.length +
    targetTypes.length +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-ink font-display flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary-400" /> Audit Log
          </h2>
          <p className="text-sm text-ink-muted mt-1">
            Every privileged change in your tenant — who, when, what, from where. Use this for compliance and incident reviews.
          </p>
        </div>
        <button
          onClick={() => data && exportAuditCsv(data.items)}
          disabled={!data || data.items.length === 0}
          className="btn-secondary text-xs whitespace-nowrap"
        >
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>

      <div className="card p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <Filter className="h-4 w-4 text-primary-400" />
          <h3 className="text-sm font-semibold text-ink">Filters</h3>
          {activeFilterCount > 0 && (
            <span className="badge badge-blue text-[10px]">{activeFilterCount} active</span>
          )}
          <div className="flex-1" />
          {activeFilterCount > 0 && (
            <button onClick={resetFilters} className="btn-secondary text-xs">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-5 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="input pl-10"
              placeholder="Search by summary, actor email, or action…"
            />
          </div>
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
              <input
                type="datetime-local"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value)
                  setPage(1)
                }}
                className="input pl-10"
                aria-label="From date"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
              <input
                type="datetime-local"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value)
                  setPage(1)
                }}
                className="input pl-10"
                aria-label="To date"
              />
            </div>
          </div>
        </div>

        <div>
          <p className="text-[10px] text-ink-muted uppercase mb-1.5">Action category</p>
          <div className="flex flex-wrap gap-1.5">
            {ACTION_GROUPS.map((g) => {
              const active = groupKeys.includes(g.key)
              return (
                <button
                  key={g.key}
                  onClick={() => toggleGroup(g.key)}
                  className={
                    'badge text-[10px] cursor-pointer transition ' +
                    (active ? g.color : 'badge-gray opacity-60 hover:opacity-100')
                  }
                >
                  {g.label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <p className="text-[10px] text-ink-muted uppercase mb-1.5">Target type</p>
          <div className="flex flex-wrap gap-1.5">
            {TARGET_TYPES.map((t) => {
              const active = targetTypes.includes(t.value)
              return (
                <button
                  key={t.value}
                  onClick={() => toggleTarget(t.value)}
                  className={
                    'badge text-[10px] cursor-pointer transition ' +
                    (active ? 'badge-blue' : 'badge-gray opacity-60 hover:opacity-100')
                  }
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : !data || data.items.length === 0 ? (
        <div className="card p-12 text-center text-ink-muted">
          <Activity className="h-10 w-10 mx-auto mb-3" /> No audit entries match these filters.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-4 py-2 flex items-center justify-between border-b border-border bg-surface-elevated/30">
            <p className="text-xs text-ink-muted">
              Showing {data.items.length} of {data.total.toLocaleString()} {data.total === 1 ? 'entry' : 'entries'}
              {isFetching && <span className="ml-2 italic">refreshing…</span>}
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-elevated/50 border-b border-border">
                <th className="px-4 py-2 w-6"></th>
                <th className="px-4 py-2 text-left text-xs font-medium text-ink-muted uppercase whitespace-nowrap">When</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-ink-muted uppercase">Actor</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-ink-muted uppercase">Action</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-ink-muted uppercase">Subject</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-ink-muted uppercase">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {data.items.map((row) => (
                <AuditRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            Previous
          </button>
          <span className="text-sm text-ink-secondary">
            Page {page} of {data.pages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page === data.pages}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

function AuditRow({ row }: { row: AuditEntry }) {
  const [open, setOpen] = useState(false)
  const badgeClass = ACTION_BADGE[row.action] ?? 'badge-blue'
  const hasMeta = row.event_metadata && Object.keys(row.event_metadata).length > 0
  const subject = describeSubject(row)
  const roleClass = row.actor_role ? ROLE_BADGE[row.actor_role.toLowerCase()] ?? 'badge-gray' : null

  return (
    <Fragment>
      <tr className="hover:bg-surface-elevated/40 transition-colors">
        <td className="px-4 py-3 align-top">
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-ink-muted hover:text-ink"
            aria-label={open ? 'Collapse row' : 'Expand row'}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </td>
        <td
          className="px-4 py-3 align-top text-xs text-ink-muted whitespace-nowrap"
          title={formatDateTime(row.created_at)}
        >
          {timeAgo(row.created_at)}
        </td>
        <td className="px-4 py-3 align-top text-xs">
          {row.actor_email ? (
            <div className="text-ink-secondary truncate max-w-[220px]" title={row.actor_email}>
              {row.actor_email}
            </div>
          ) : (
            <span className="italic text-ink-muted">system</span>
          )}
          {row.actor_role && roleClass && (
            <span className={'text-[9px] mt-1 ' + roleClass}>{row.actor_role}</span>
          )}
        </td>
        <td className="px-4 py-3 align-top">
          <span className={'text-[10px] ' + badgeClass}>{row.action}</span>
        </td>
        <td className="px-4 py-3 align-top text-xs">
          {subject ? (
            <>
              <div className="flex items-center gap-1 text-ink">
                {row.target_type === 'user' || row.target_type === 'enrollment' ? (
                  <UserIcon className="h-3 w-3 text-ink-muted" />
                ) : null}
                <span className="truncate max-w-[200px]" title={subject.primary}>
                  {subject.primary}
                </span>
              </div>
              {subject.secondary && (
                <div className="text-ink-muted truncate max-w-[200px]" title={subject.secondary}>
                  {subject.secondary}
                </div>
              )}
            </>
          ) : (
            <span className="text-ink-muted">—</span>
          )}
        </td>
        <td className="px-4 py-3 align-top text-xs text-ink-secondary">
          <span className="line-clamp-2" title={row.summary ?? ''}>
            {row.summary ?? '—'}
          </span>
        </td>
      </tr>
      {open && (
        <tr className="bg-surface-elevated/30">
          <td colSpan={6} className="px-6 py-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-ink-secondary">
              <Detail label="When" value={formatDateTime(row.created_at)} />
              <Detail label="IP" value={row.ip_address ?? '—'} />
              <Detail label="User agent" value={row.user_agent ?? '—'} />
              <Detail label="Target type" value={row.target_type ?? '—'} />
              <Detail label="Target ID" value={row.target_id ?? '—'} mono />
              <Detail
                label="Actor"
                value={
                  row.actor_email
                    ? `${row.actor_email}${row.actor_role ? ` (${row.actor_role})` : ''}`
                    : 'system'
                }
              />
            </div>
            {row.students && row.students.length > 0 && (
              <details className="mt-3" open>
                <summary className="cursor-pointer text-[10px] text-ink-muted uppercase">
                  Students affected ({row.students.length})
                </summary>
                <ul className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  {row.students.map((s) => (
                    <li key={s.id} className="flex justify-between gap-2">
                      <span className="text-ink truncate">{s.full_name}</span>
                      <span className="text-ink-muted truncate">{s.email}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {hasMeta && (
              <details className="mt-3">
                <summary className="cursor-pointer text-[10px] text-ink-muted uppercase">
                  Raw event_metadata
                </summary>
                <pre className="mt-2 p-3 rounded bg-surface-overlay text-[11px] overflow-x-auto text-ink-secondary">
                  {JSON.stringify(row.event_metadata, null, 2)}
                </pre>
              </details>
            )}
          </td>
        </tr>
      )}
    </Fragment>
  )
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-ink-muted mb-0.5">{label}</p>
      <p className={mono ? 'font-mono text-ink-secondary break-all' : 'text-ink-secondary break-all'}>{value}</p>
    </div>
  )
}
