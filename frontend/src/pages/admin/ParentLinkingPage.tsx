import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  Link2,
  Plus,
  Search,
  Trash2,
  Users as UsersIcon,
} from 'lucide-react'

import api from '@/config/axios'
import { Modal } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/Spinner'
import { useDebounce } from '@/hooks/useDebounce'
import {
  ParentLinkCreate,
  useCreateParentLink,
  useDeleteParentLink,
  useParentLinks,
} from '@/api/parentLinks'
import type { PaginatedResponse } from '@/types/common'
import type { User } from '@/types/user'
import { formatDate } from '@/utils/formatters'

export function ParentLinkingPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debounced = useDebounce(search)
  const [showCreate, setShowCreate] = useState(false)
  const { data, isLoading } = useParentLinks({
    page,
    page_size: 25,
    search: debounced || undefined,
  })
  const { mutate: deleteLink, isPending: deleting } = useDeleteParentLink()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink font-display">Parent ↔ Student Links</h2>
          <p className="text-sm text-ink-muted mt-1">
            Link parent accounts to the children they're authorized to see. Parents get read-only access to a child's grades and attendance once linked.
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Link Parent
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="input pl-10"
          placeholder="Search parent or student name/email…"
        />
      </div>

      {isLoading ? (
        <PageLoader />
      ) : !data || data.items.length === 0 ? (
        <div className="card p-12 text-center text-ink-muted">
          <Link2 className="h-10 w-10 mx-auto mb-3" />
          {search ? 'No links match this search.' : 'No parent–student links yet.'}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-elevated/50 border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-medium text-ink-muted uppercase">Parent</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-ink-muted uppercase">Student</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-ink-muted uppercase">Linked</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-ink-muted uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {data.items.map((link) => (
                <tr key={link.id} className="hover:bg-surface-elevated/50">
                  <td className="px-5 py-3">
                    <div>
                      <p className="font-medium text-ink">{link.parent_name}</p>
                      <p className="text-xs text-ink-muted">{link.parent_email}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div>
                      <p className="font-medium text-ink">{link.student_name}</p>
                      <p className="text-xs text-ink-muted">{link.student_email}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-ink-muted">{formatDate(link.created_at)}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Remove the link between ${link.parent_name} and ${link.student_name}? The parent will lose access to this student.`
                          )
                        ) {
                          deleteLink(link.id)
                        }
                      }}
                      disabled={deleting}
                      className="btn-secondary text-xs px-2 py-1 text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
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

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Link Parent to Student" size="lg">
        <CreateLinkForm onSuccess={() => setShowCreate(false)} onCancel={() => setShowCreate(false)} />
      </Modal>
    </div>
  )
}

function useParents() {
  return useQuery<PaginatedResponse<User>>({
    queryKey: ['users', 'parent-options'],
    queryFn: () =>
      api.get('/users', { params: { role: 'parent', page_size: 100 } }).then((r) => r.data),
  })
}

function useStudents() {
  return useQuery<PaginatedResponse<User>>({
    queryKey: ['users', 'student-options'],
    queryFn: () =>
      api.get('/users', { params: { role: 'student', page_size: 200 } }).then((r) => r.data),
  })
}

function CreateLinkForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const { data: parents } = useParents()
  const { data: students } = useStudents()
  const { mutate, isPending, error } = useCreateParentLink()
  const form = useForm<ParentLinkCreate>({
    defaultValues: { parent_id: '', student_id: '' },
  })

  const apiDetail = (error as { response?: { data?: { detail?: unknown } } } | null)?.response?.data?.detail

  const onSubmit = form.handleSubmit((values) => {
    mutate(
      { parent_id: values.parent_id, student_id: values.student_id },
      { onSuccess }
    )
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label flex items-center gap-2">
          <UsersIcon className="h-3.5 w-3.5" /> Parent account
        </label>
        <select {...form.register('parent_id', { required: true })} className="input">
          <option value="">— Select parent —</option>
          {parents?.items.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name} — {p.email}
            </option>
          ))}
        </select>
        {parents && parents.items.length === 0 && (
          <p className="text-xs text-amber-400 mt-1">
            No parent accounts in this tenant yet. Create one from Users → Add User first.
          </p>
        )}
      </div>

      <div>
        <label className="label flex items-center gap-2">
          <UsersIcon className="h-3.5 w-3.5" /> Student
        </label>
        <select {...form.register('student_id', { required: true })} className="input">
          <option value="">— Select student —</option>
          {students?.items.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name} — {s.email}
            </option>
          ))}
        </select>
      </div>

      {!!apiDetail && (
        <p className="text-sm text-rose-400 flex items-center gap-1">
          <AlertCircle className="h-4 w-4" /> {typeof apiDetail === 'string' ? apiDetail : 'Link failed'}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">
          Cancel
        </button>
        <button type="submit" disabled={isPending} className="btn-primary flex-1">
          {isPending ? 'Linking…' : 'Create Link'}
        </button>
      </div>
    </form>
  )
}
