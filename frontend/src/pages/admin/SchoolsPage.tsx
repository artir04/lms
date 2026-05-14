import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import {
  Plus,
  School as SchoolIcon,
  Users as UsersIcon,
  BookOpen,
  Calendar,
  Pencil,
  Archive,
  CheckCircle2,
} from 'lucide-react'

import api from '@/config/axios'
import { Modal } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/Spinner'
import {
  School,
  SchoolPayload,
  SchoolUpdatePayload,
  useCreateSchool,
  useDeactivateSchool,
  useSchools,
  useUpdateSchool,
} from '@/api/schools'
import { toast } from '@/store/toastStore'
import type { PaginatedResponse } from '@/types/common'
import type { User } from '@/types/user'

interface UserOption {
  id: string
  full_name: string
  email: string
}

function usePrincipalCandidates() {
  return useQuery<UserOption[]>({
    queryKey: ['users', 'principal-candidates'],
    queryFn: async () => {
      const [admins, teachers] = await Promise.all([
        api.get<PaginatedResponse<User>>('/users', { params: { role: 'admin', page_size: 100 } }),
        api.get<PaginatedResponse<User>>('/users', { params: { role: 'teacher', page_size: 100 } }),
      ])
      const merged = [...admins.data.items, ...teachers.data.items]
      const dedup = new Map<string, UserOption>()
      for (const u of merged) {
        if (!dedup.has(u.id)) dedup.set(u.id, { id: u.id, full_name: u.full_name, email: u.email })
      }
      return Array.from(dedup.values()).sort((a, b) => a.full_name.localeCompare(b.full_name))
    },
  })
}

export function SchoolsPage() {
  const [includeInactive, setIncludeInactive] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<School | null>(null)
  const { data, isLoading } = useSchools(includeInactive)
  const { data: candidates } = usePrincipalCandidates()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink font-display">Schools</h2>
          <p className="text-sm text-ink-muted mt-1">
            Manage schools in your district, assign principals, and set academic year.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-ink-secondary">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="rounded"
            />
            Show deactivated
          </label>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> Add School
          </button>
        </div>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : !data || data.length === 0 ? (
        <div className="card p-12 text-center">
          <SchoolIcon className="h-10 w-10 text-ink-muted mx-auto mb-3" />
          <p className="text-ink-muted">No schools yet. Click "Add School" to create the first one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.map((school) => (
            <SchoolCard
              key={school.id}
              school={school}
              onEdit={() => setEditing(school)}
            />
          ))}
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create School" size="lg">
        <SchoolForm
          principals={candidates ?? []}
          onSuccess={() => setShowCreate(false)}
          onCancel={() => setShowCreate(false)}
        />
      </Modal>

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title={`Edit ${editing?.name ?? ''}`} size="lg">
        {editing && (
          <SchoolForm
            initial={editing}
            principals={candidates ?? []}
            onSuccess={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  )
}

function SchoolCard({ school, onEdit }: { school: School; onEdit: () => void }) {
  const { mutate: deactivate, isPending } = useDeactivateSchool()
  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
            <SchoolIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-ink truncate font-display">{school.name}</h3>
            <p className="text-xs text-ink-muted">{school.code}</p>
          </div>
        </div>
        {!school.is_active && <span className="badge badge-red text-[10px]">Inactive</span>}
      </div>

      <div className="space-y-1.5 text-sm">
        <div className="flex items-center gap-2 text-ink-muted">
          <Calendar className="h-3.5 w-3.5" />
          <span>{school.academic_year ?? 'No academic year set'}</span>
        </div>
        <div className="flex items-center gap-2 text-ink-muted">
          <UsersIcon className="h-3.5 w-3.5" />
          <span>
            Principal: {school.principal_name ? (
              <span className="text-ink-secondary">{school.principal_name}</span>
            ) : (
              <span className="italic">Unassigned</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-ink-muted pt-1">
          <span className="flex items-center gap-1">
            <UsersIcon className="h-3 w-3" /> {school.user_count} users
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" /> {school.course_count} courses
          </span>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onEdit} className="btn-secondary flex-1 text-xs">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
        {school.is_active && (
          <button
            onClick={() => {
              if (confirm(`Deactivate ${school.name}? Users and courses remain but the school is hidden from new operations.`)) {
                deactivate(school.id)
              }
            }}
            disabled={isPending}
            className="btn-secondary text-xs text-rose-400"
          >
            <Archive className="h-3.5 w-3.5" /> Deactivate
          </button>
        )}
      </div>
    </div>
  )
}

interface FormValues {
  name: string
  code: string
  academic_year: string
  principal_id: string
  is_active: boolean
}

function SchoolForm({
  initial,
  principals,
  onSuccess,
  onCancel,
}: {
  initial?: School
  principals: UserOption[]
  onSuccess: () => void
  onCancel: () => void
}) {
  const { mutate: create, isPending: creating } = useCreateSchool()
  const { mutate: update, isPending: updating } = useUpdateSchool()
  const pending = creating || updating

  const defaultValues = useMemo<FormValues>(
    () => ({
      name: initial?.name ?? '',
      code: initial?.code ?? '',
      academic_year: initial?.academic_year ?? '',
      principal_id: initial?.principal_id ?? '',
      is_active: initial?.is_active ?? true,
    }),
    [initial]
  )

  const form = useForm<FormValues>({ defaultValues })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const principalOptions = useMemo<UserOption[]>(() => {
    if (!initial?.principal_id) return principals
    const alreadyIncluded = principals.some((p) => p.id === initial.principal_id)
    if (alreadyIncluded) return principals
    return [
      {
        id: initial.principal_id,
        full_name: initial.principal_name ?? 'Current principal',
        email: initial.principal_email ?? '',
      },
      ...principals,
    ]
  }, [principals, initial?.principal_id, initial?.principal_name, initial?.principal_email])

  const extractError = (err: unknown): string => {
    const detail = (err as { response?: { data?: { detail?: unknown } } } | null)?.response?.data
      ?.detail
    if (typeof detail === 'string') return detail
    return 'Save failed'
  }

  const onSubmit = form.handleSubmit((values) => {
    const payload: SchoolPayload & SchoolUpdatePayload = {
      name: values.name.trim(),
      code: values.code.trim(),
      academic_year: values.academic_year.trim() || null,
      principal_id: values.principal_id || null,
      is_active: values.is_active,
    }
    if (initial) {
      update(
        { id: initial.id, data: payload },
        {
          onSuccess: (school: School) => {
            toast.success(`${school.name} was updated`, { title: 'School saved' })
            onSuccess()
          },
          onError: (err) => {
            toast.error(extractError(err), { title: 'School save failed' })
          },
        }
      )
    } else {
      const { is_active: _ignore, ...createPayload } = payload
      create(createPayload as SchoolPayload, {
        onSuccess: (school: School) => {
          toast.success(`${school.name} was created`, { title: 'School created' })
          onSuccess()
        },
        onError: (err) => {
          toast.error(extractError(err), { title: 'School creation failed' })
        },
      })
    }
  })

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">School Name</label>
          <input {...form.register('name', { required: true })} className="input" placeholder="Lincoln High School" />
        </div>
        <div>
          <label className="label">Code</label>
          <input {...form.register('code', { required: true })} className="input" placeholder="LHS-01" />
        </div>
        <div>
          <label className="label">Academic Year</label>
          <input {...form.register('academic_year')} className="input" placeholder="2025-2026" />
        </div>
        <div>
          <label className="label">Principal</label>
          <Controller
            control={form.control}
            name="principal_id"
            render={({ field }) => (
              <select
                className="input"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
                ref={field.ref}
                name={field.name}
              >
                <option value="">Unassigned</option>
                {principalOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                    {p.email ? ` — ${p.email}` : ''}
                  </option>
                ))}
              </select>
            )}
          />
        </div>
      </div>

      {initial && (
        <div className="flex items-center gap-3">
          <input type="checkbox" id="school_active" {...form.register('is_active')} className="rounded" />
          <label htmlFor="school_active" className="text-sm text-ink-secondary">
            Active (uncheck to hide from new operations)
          </label>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">
          Cancel
        </button>
        <button type="submit" disabled={pending} className="btn-primary flex-1 flex items-center justify-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {pending ? 'Saving…' : initial ? 'Save Changes' : 'Create School'}
        </button>
      </div>
    </form>
  )
}
