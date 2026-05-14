import { useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/config/axios'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { PageLoader } from '@/components/ui/Spinner'
import { useDebounce } from '@/hooks/useDebounce'
import { useForm } from 'react-hook-form'
import type { User } from '@/types/user'
import type { PaginatedResponse } from '@/types/common'
import { formatDate } from '@/utils/formatters'
import { toast } from '@/store/toastStore'
import { useAuth } from '@/hooks/useAuth'

export function UserManagementPage() {
  const qc = useQueryClient()
  const { user: currentUser } = useAuth()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const debouncedSearch = useDebounce(search)

  const { data, isLoading } = useQuery<PaginatedResponse<User>>({
    queryKey: ['users', page, debouncedSearch, role],
    queryFn: () => api.get('/users', { params: { page, page_size: 20, search: debouncedSearch || undefined, role: role || undefined } }).then((r) => r.data),
  })

  const { mutate: createUser, isPending } = useMutation({
    mutationFn: (data: any) => api.post('/users', { ...data, roles: [data.role] }).then((r) => r.data),
    onSuccess: (user: User) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setShowCreate(false)
      reset()
      toast.success(`${user.full_name} was created successfully`, { title: 'User created' })
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail ?? 'Failed to create user'
      toast.error(typeof message === 'string' ? message : 'Failed to create user', { title: 'User creation failed' })
    },
  })

  const { mutate: deleteUser, isPending: isDeleting } = useMutation({
    mutationFn: (user: User) => api.delete(`/users/${user.id}`).then((r) => r.data),
    onSuccess: (_data, user) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setUserToDelete(null)
      toast.success(`${user.full_name} was deleted`, { title: 'User deleted' })
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail ?? 'Failed to delete user'
      toast.error(typeof message === 'string' ? message : 'Failed to delete user', { title: 'User deletion failed' })
    },
  })

  const { register, handleSubmit, reset } = useForm()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-ink font-display">User Management</h2>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="h-4 w-4" />
          Add User
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="input pl-10" placeholder="Search users..." />
        </div>
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1) }} className="input w-40">
          <option value="">All roles</option>
          <option value="student">Students</option>
          <option value="teacher">Teachers</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-elevated/50 border-b border-border">
                <th className="px-6 py-3 text-left text-xs font-medium text-ink-muted uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-ink-muted uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-ink-muted uppercase">Joined</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-ink-muted uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {data?.items.map((user) => (
                <tr key={user.id} className="hover:bg-surface-elevated/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar src={user.avatar_url} name={user.full_name} size="sm" />
                      <div>
                        <p className="font-medium text-ink">{user.full_name}</p>
                        <p className="text-xs text-ink-muted">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="badge badge-blue capitalize">{user.roles[0]}</span>
                  </td>
                  <td className="px-6 py-4 text-ink-muted text-xs">{formatDate(user.created_at)}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setUserToDelete(user)}
                      disabled={user.id === currentUser?.id}
                      title={user.id === currentUser?.id ? "You can't delete your own account" : 'Delete user'}
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
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
          <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} className="btn-secondary px-3 py-1.5 text-xs">Previous</button>
          <span className="text-sm text-ink-secondary">Page {page} of {data.pages}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page === data.pages} className="btn-secondary px-3 py-1.5 text-xs">Next</button>
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add New User">
        <form onSubmit={handleSubmit((d) => createUser(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First Name</label>
              <input {...register('first_name', { required: true })} className="input" />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input {...register('last_name', { required: true })} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input {...register('email', { required: true })} type="email" className="input" />
          </div>
          <div>
            <label className="label">Password</label>
            <input {...register('password')} type="password" className="input" placeholder="Leave blank for SSO users" />
          </div>
          <div>
            <label className="label">Role</label>
            <select {...register('role')} className="input">
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1">
              {isPending ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={userToDelete !== null} onClose={() => setUserToDelete(null)} title="Delete user" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-ink-secondary">
            Are you sure you want to delete <span className="font-medium text-ink">{userToDelete?.full_name}</span>? This permanently removes their account and cannot be undone.
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setUserToDelete(null)} className="btn-secondary flex-1" disabled={isDeleting}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => userToDelete && deleteUser(userToDelete)}
              disabled={isDeleting}
              className="btn-primary flex-1 bg-red-500 hover:bg-red-400 border-red-500"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
