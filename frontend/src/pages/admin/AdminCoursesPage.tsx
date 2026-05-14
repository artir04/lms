import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Archive,
  ArchiveRestore,
  BookOpen,
  Search,
  Users as UsersIcon,
  UserCog,
  ExternalLink,
} from 'lucide-react'

import api from '@/config/axios'
import { Modal } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/Spinner'
import { useDebounce } from '@/hooks/useDebounce'
import { ROUTES } from '@/config/routes'
import {
  AdminCourseRow,
  useAdminCourses,
  useArchiveCourse,
  useReassignTeacher,
  useUnarchiveCourse,
} from '@/api/adminCourses'
import { toast } from '@/store/toastStore'
import type { PaginatedResponse } from '@/types/common'
import type { User } from '@/types/user'
import { formatDate } from '@/utils/formatters'

type StatusFilter = 'active' | 'published' | 'draft' | 'archived'

export function AdminCoursesPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [page, setPage] = useState(1)
  const debounced = useDebounce(search)
  const [reassigning, setReassigning] = useState<AdminCourseRow | null>(null)

  const { data, isLoading } = useAdminCourses({
    page,
    page_size: 20,
    search: debounced || undefined,
    status,
  })

  const { mutate: archive, isPending: archiving } = useArchiveCourse()
  const { mutate: unarchive, isPending: unarchiving } = useUnarchiveCourse()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-ink font-display">Course Oversight</h2>
        <p className="text-sm text-ink-muted mt-1">
          View every course in your tenant, archive stale ones, and reassign teachers.
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="input pl-10"
            placeholder="Search by course title…"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as StatusFilter)
            setPage(1)
          }}
          className="input w-48"
        >
          <option value="active">Active (not archived)</option>
          <option value="published">Published only</option>
          <option value="draft">Drafts only</option>
          <option value="archived">Archived only</option>
        </select>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-elevated/50 border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-medium text-ink-muted uppercase">Course</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-ink-muted uppercase">Teacher</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-ink-muted uppercase">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-ink-muted uppercase">Roster</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-ink-muted uppercase">Created</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-ink-muted uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {data?.items.map((c) => (
                <tr key={c.id} className="hover:bg-surface-elevated/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <BookOpen className="h-4 w-4 text-ink-muted shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-ink truncate">{c.title}</p>
                        <p className="text-xs text-ink-muted truncate">
                          {[c.subject, c.grade_level].filter(Boolean).join(' • ') || '—'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div>
                      <p className="text-ink-secondary">{c.teacher_name}</p>
                      <p className="text-xs text-ink-muted">{c.teacher_email}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-col gap-1">
                      {c.is_archived ? (
                        <span className="badge badge-red text-[10px]">Archived</span>
                      ) : c.is_published ? (
                        <span className="badge badge-green text-[10px]">Published</span>
                      ) : (
                        <span className="badge badge-yellow text-[10px]">Draft</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-ink-secondary text-xs">
                    <span className="flex items-center gap-1">
                      <UsersIcon className="h-3 w-3" /> {c.enrollment_count} in {c.section_count} section{c.section_count === 1 ? '' : 's'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-ink-muted text-xs">{formatDate(c.created_at)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        to={ROUTES.COURSE_DETAIL(c.id)}
                        className="btn-secondary text-xs px-2 py-1"
                        title="View course"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        onClick={() => setReassigning(c)}
                        className="btn-secondary text-xs px-2 py-1"
                        title="Reassign teacher"
                      >
                        <UserCog className="h-3.5 w-3.5" />
                      </button>
                      {c.is_archived ? (
                        <button
                          disabled={unarchiving}
                          onClick={() => unarchive(c.id)}
                          className="btn-secondary text-xs px-2 py-1 text-emerald-400"
                          title="Unarchive"
                        >
                          <ArchiveRestore className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          disabled={archiving}
                          onClick={() => {
                            if (confirm(`Archive "${c.title}"? It will be hidden from teachers and students.`)) {
                              archive(c.id)
                            }
                          }}
                          className="btn-secondary text-xs px-2 py-1 text-rose-400"
                          title="Archive"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data && data.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-ink-muted">
                    No courses match these filters.
                  </td>
                </tr>
              )}
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

      <Modal isOpen={!!reassigning} onClose={() => setReassigning(null)} title="Reassign Teacher" size="lg">
        {reassigning && (
          <ReassignForm
            course={reassigning}
            onSuccess={() => setReassigning(null)}
            onCancel={() => setReassigning(null)}
          />
        )}
      </Modal>
    </div>
  )
}

function ReassignForm({
  course,
  onSuccess,
  onCancel,
}: {
  course: AdminCourseRow
  onSuccess: () => void
  onCancel: () => void
}) {
  const [teacherId, setTeacherId] = useState('')
  const { mutate, isPending } = useReassignTeacher()

  const { data: teachers } = useQuery<PaginatedResponse<User>>({
    queryKey: ['users', 'teachers-for-reassign'],
    queryFn: () =>
      api.get('/users', { params: { role: 'teacher', page_size: 100 } }).then((r) => r.data),
  })

  const handleReassign = () => {
    const newTeacher = teachers?.items.find((t) => t.id === teacherId)
    mutate(
      { courseId: course.id, teacherId },
      {
        onSuccess: () => {
          const target = newTeacher?.full_name ?? 'the selected teacher'
          toast.success(`${course.title} reassigned to ${target}`, { title: 'Teacher reassigned' })
          onSuccess()
        },
        onError: (err) => {
          const detail = (err as { response?: { data?: { detail?: unknown } } } | null)?.response
            ?.data?.detail
          const message = typeof detail === 'string' ? detail : 'Reassign failed'
          toast.error(message, { title: 'Reassign failed' })
        },
      }
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-secondary">
        Move <span className="font-semibold text-ink">{course.title}</span> from{' '}
        <span className="text-ink">{course.teacher_name}</span> to a different teacher. Existing enrollments,
        grades, and content stay with the course.
      </p>

      <div>
        <label className="label">New teacher</label>
        <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="input">
          <option value="">— Select a teacher —</option>
          {teachers?.items
            .filter((t) => t.id !== course.teacher_id)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name} — {t.email}
              </option>
            ))}
        </select>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="btn-secondary flex-1">
          Cancel
        </button>
        <button
          onClick={handleReassign}
          disabled={!teacherId || isPending}
          className="btn-primary flex-1"
        >
          {isPending ? 'Reassigning…' : 'Reassign'}
        </button>
      </div>
    </div>
  )
}
