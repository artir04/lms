import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useCourses, useCreateCourse } from '@/api/courses'
import { CourseCard } from '@/components/course/CourseCard'
import { Modal } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'
import { useDebounce } from '@/hooks/useDebounce'
import { useForm } from 'react-hook-form'

export function CourseListPage() {
  const { isTeacher, isAdmin } = useAuth()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const debouncedSearch = useDebounce(search, 400)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useCourses({ page, page_size: 12, search: debouncedSearch || undefined })
  const { mutate: createCourse, isPending } = useCreateCourse()
  const { register, handleSubmit, reset } = useForm()

  const onCreate = (data: any) => {
    createCourse(data, { onSuccess: () => { setShowCreate(false); reset() } })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Courses</h2>
        {(isTeacher || isAdmin) && (
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            New Course
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="input pl-10"
          placeholder="Search courses..."
        />
      </div>

      {isLoading ? (
        <PageLoader />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {data?.items.map((course) => <CourseCard key={course.id} course={course} />)}
            {!data?.items.length && (
              <p className="text-gray-500 col-span-3 text-center py-16">No courses found.</p>
            )}
          </div>

          {/* Pagination */}
          {data && data.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} className="btn-secondary px-3 py-1.5 text-xs">Previous</button>
              <span className="text-sm text-gray-600">Page {page} of {data.pages}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page === data.pages} className="btn-secondary px-3 py-1.5 text-xs">Next</button>
            </div>
          )}
        </>
      )}

      {/* Create Course Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Course">
        <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input {...register('title', { required: true })} className="input" placeholder="e.g. Algebra I" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea {...register('description')} rows={3} className="input resize-none" placeholder="Course overview..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Subject</label>
              <input {...register('subject')} className="input" placeholder="e.g. Math" />
            </div>
            <div>
              <label className="label">Grade Level</label>
              <select {...register('grade_level')} className="input">
                <option value="">All grades</option>
                {['6','7','8','9','10','11','12'].map((g) => <option key={g} value={g}>Grade {g}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1">
              {isPending ? 'Creating...' : 'Create Course'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
