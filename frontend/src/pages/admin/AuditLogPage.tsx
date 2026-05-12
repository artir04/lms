import { useMemo, useState } from 'react'
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Search,
  ShieldCheck,
} from 'lucide-react'

import { PageLoader } from '@/components/ui/Spinner'
import { useDebounce } from '@/hooks/useDebounce'
import { AuditEntry, useAuditLogs } from '@/api/audit'
import { formatDateTime } from '@/utils/formatters'

const ACTION_GROUPS: { label: string; value: string }[] = [
  { label: 'All actions', value: '' },
  { label: 'User changes', value: 'user.' },
  { label: 'Course changes', value: 'course.' },
  { label: 'Enrollment changes', value: 'enrollment.' },
  { label: 'Parent links', value: 'parent_link.' },
  { label: 'Schools', value: 'school.' },
  { label: 'Tenant settings', value: 'tenant.' },
]

const ACTION_BADGE: Record<string, string> = {
  'user.create': 'badge-green',
  'user.update': 'badge-blue',
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
  'enrollment.csv_import': 'badge-blue',
  'parent_link.create': 'badge-green',
  'parent_link.delete': 'badge-red',
  'school.create': 'badge-green',
  'school.update': 'badge-blue',
  'school.deactivate': 'badge-red',
  'tenant.settings.update': 'badge-blue',
}

export function AuditLogPage() {
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState('')
  const [page, setPage] = useState(1)
  const debounced = useDebounce(search)

  const { data, isLoading } = useAuditLogs({
    page,
    page_size: 25,
    search: debounced || undefined,
  })

  const filtered = useMemo<AuditEntry[]>(() => {
    if (!data) return []
    if (!group) return data.items
    return data.items.filter((row) => row.action.startsWith(group))
  }, [data, group])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-ink font-display flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary-400" /> Audit Log
        </h2>
        <p className="text-sm text-ink-muted mt-1">
          Every privileged change in your tenant — who, when, what, from where. Use this for compliance and incident reviews.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="input pl-10"
            placeholder="Search by summary, email, or action…"
          />
        </div>
        <select value={group} onChange={(e) => setGroup(e.target.value)} className="input w-56">
          {ACTION_GROUPS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-ink-muted">
          <Activity className="h-10 w-10 mx-auto mb-3" /> No audit entries match these filters.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-elevated/50 border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-medium text-ink-muted uppercase w-44">When</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-ink-muted uppercase">Actor</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-ink-muted uppercase">Action</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-ink-muted uppercase">Summary</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-ink-muted uppercase w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map((row) => (
                <AuditRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} className="btn-secondary px-3 py-1.5 text-xs">
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

  return (
    <>
      <tr className="hover:bg-surface-elevated/50">
        <td className="px-5 py-3 text-xs text-ink-muted">{formatDateTime(row.created_at)}</td>
        <td className="px-5 py-3">
          <p className="text-ink-secondary text-sm">{row.actor_email ?? <span className="italic text-ink-muted">system</span>}</p>
          {row.actor_role && (
            <p className="text-[10px] uppercase text-ink-muted tracking-wide">{row.actor_role}</p>
          )}
        </td>
        <td className="px-5 py-3">
          <span className={`badge ${badgeClass} text-[10px]`}>{row.action}</span>
        </td>
        <td className="px-5 py-3 text-ink-secondary text-sm">{row.summary ?? '—'}</td>
        <td className="px-5 py-3 text-right">
          {hasMeta || row.ip_address ? (
            <button
              onClick={() => setOpen((v) => !v)}
              className="text-ink-muted hover:text-ink p-1"
              aria-label="Toggle details"
            >
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : null}
        </td>
      </tr>
      {open && (
        <tr className="bg-surface-elevated/30">
          <td colSpan={5} className="px-5 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <Detail label="IP" value={row.ip_address ?? '—'} />
              <Detail label="User agent" value={row.user_agent ?? '—'} />
              <Detail label="Target type" value={row.target_type ?? '—'} />
              <Detail label="Target ID" value={row.target_id ?? '—'} mono />
              {hasMeta && (
                <div className="col-span-1 sm:col-span-2">
                  <p className="text-[10px] uppercase text-ink-muted mb-1">Metadata</p>
                  <pre className="bg-surface-overlay rounded-md p-3 text-[11px] overflow-x-auto text-ink-secondary">
                    {JSON.stringify(row.event_metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
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
