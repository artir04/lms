import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Pencil, Trash2, GripVertical, ChevronDown, ChevronRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useCourse, useUpdateCourse } from '@/api/courses'
import { Modal } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/Spinner'
import { ROUTES } from '@/config/routes'
import api from '@/config/axios'

interface Module {
  id: string
  title: string
  position: number
  lesson_count: number
  lessons?: Lesson[]
}

interface Lesson {
  id: string
  title: string
  content_type: string
  position: number
  duration_min: number | null
}

export function CourseEditorPage() {
  const { courseId } = useParams<{ courseId: string }>()!
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: course, isLoading } = useCourse(courseId!)
  const { mutate: updateCourse, isPending: savingCourse } = useUpdateCourse(courseId!)

  const { data: modules, isLoading: modulesLoading } = useQuery<Module[]>({
    queryKey: ['modules', courseId],
    queryFn: () => api.get(`/courses/${courseId}/modules`).then((r) => r.data),
    enabled: !!courseId,
  })

  const { mutate: createModule, isPending: creatingModule } = useMutation({
    mutationFn: (data: { title: string }) => api.post(`/courses/${courseId}/modules`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modules', courseId] }),
  })

  const { mutate: deleteModule } = useMutation({
    mutationFn: (moduleId: string) => api.delete(`/courses/${courseId}/modules/${moduleId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modules', courseId] }),
  })

  const { mutate: createLesson, isPending: creatingLesson } = useMutation({
    mutationFn: ({ moduleId, data }: { moduleId: string; data: any }) =>
      api.post(`/courses/${courseId}/modules/${moduleId}/lessons`, data).then((r) => r.data),
    onSuccess: (_d, { moduleId }) => {
      qc.invalidateQueries({ queryKey: ['modules', courseId] })
      qc.invalidateQueries({ queryKey: ['lessons', moduleId] })
    },
  })

  const { mutate: deleteLesson } = useMutation({
    mutationFn: ({ lessonId }: { lessonId: string; moduleId: string }) =>
      api.delete(`/courses/${courseId}/lessons/${lessonId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modules', courseId] }),
  })

  // Modal states
  const [showEditCourse, setShowEditCourse] = useState(false)
  const [showAddModule, setShowAddModule] = useState(false)
  const [addLessonModuleId, setAddLessonModuleId] = useState<string | null>(null)
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())

  const courseForm = useForm({ values: { title: course?.title || '', description: course?.description || '', subject: course?.subject || '', grade_level: course?.grade_level || '', is_published: course?.is_published ?? false } })
  const moduleForm = useForm<{ title: string }>()
  const lessonForm = useForm<{ title: string; content_type: string; duration_min: string }>({
    defaultValues: { content_type: 'text' },
  })

  const toggleModule = (id: string) =>
    setExpandedModules((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  if (isLoading) return <PageLoader />
  if (!course) return <div className="text-center text-gray-500 py-16">Course not found</div>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(ROUTES.COURSE_DETAIL(courseId!))} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
          <p className="text-sm text-gray-500">{course.is_published ? 'Published' : 'Draft'}</p>
        </div>
        <button onClick={() => setShowEditCourse(true)} className="btn-secondary">
          <Pencil className="h-4 w-4" /> Edit Details
        </button>
      </div>

      {/* Modules */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Course Content</h2>
          <button onClick={() => setShowAddModule(true)} className="btn-primary text-sm">
            <Plus className="h-4 w-4" /> Add Module
          </button>
        </div>

        {modulesLoading ? (
          <PageLoader />
        ) : !modules?.length ? (
          <div className="text-center text-gray-400 py-8">No modules yet. Add your first module above.</div>
        ) : (
          <div className="space-y-2">
            {modules.map((mod) => (
              <div key={mod.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Module header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50">
                  <GripVertical className="h-4 w-4 text-gray-300" />
                  <button onClick={() => toggleModule(mod.id)} className="flex-1 flex items-center gap-2 text-left">
                    {expandedModules.has(mod.id) ? (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="font-medium text-gray-900">{mod.title}</span>
                    <span className="text-xs text-gray-400 ml-1">({mod.lesson_count} lessons)</span>
                  </button>
                  <button
                    onClick={() => { setAddLessonModuleId(mod.id); lessonForm.reset({ content_type: 'text' }) }}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    + Lesson
                  </button>
                  <button onClick={() => { if (confirm('Delete this module?')) deleteModule(mod.id) }} className="text-red-400 hover:text-red-600 ml-1">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Lessons */}
                {expandedModules.has(mod.id) && (
                  <LessonList courseId={courseId!} moduleId={mod.id} onDelete={(lessonId) => deleteLesson({ lessonId, moduleId: mod.id })} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Course Modal */}
      <Modal isOpen={showEditCourse} onClose={() => setShowEditCourse(false)} title="Edit Course Details">
        <form onSubmit={courseForm.handleSubmit((d) => updateCourse(d, { onSuccess: () => setShowEditCourse(false) }))} className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input {...courseForm.register('title', { required: true })} className="input" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea {...courseForm.register('description')} rows={3} className="input resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Subject</label>
              <input {...courseForm.register('subject')} className="input" />
            </div>
            <div>
              <label className="label">Grade Level</label>
              <select {...courseForm.register('grade_level')} className="input">
                <option value="">All grades</option>
                {['6','7','8','9','10','11','12'].map((g) => <option key={g} value={g}>Grade {g}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="is_published" {...courseForm.register('is_published')} className="rounded" />
            <label htmlFor="is_published" className="text-sm text-gray-700">Published (visible to students)</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowEditCourse(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={savingCourse} className="btn-primary flex-1">
              {savingCourse ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Module Modal */}
      <Modal isOpen={showAddModule} onClose={() => setShowAddModule(false)} title="Add Module">
        <form onSubmit={moduleForm.handleSubmit((d) => createModule(d, { onSuccess: () => { setShowAddModule(false); moduleForm.reset() } }))} className="space-y-4">
          <div>
            <label className="label">Module Title *</label>
            <input {...moduleForm.register('title', { required: true })} className="input" placeholder="e.g. Unit 1: Introduction" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowAddModule(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={creatingModule} className="btn-primary flex-1">
              {creatingModule ? 'Adding...' : 'Add Module'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Lesson Modal */}
      <Modal isOpen={!!addLessonModuleId} onClose={() => setAddLessonModuleId(null)} title="Add Lesson">
        <form
          onSubmit={lessonForm.handleSubmit((d) => {
            createLesson(
              { moduleId: addLessonModuleId!, data: { ...d, duration_min: d.duration_min ? Number(d.duration_min) : null } },
              { onSuccess: () => { setAddLessonModuleId(null); lessonForm.reset({ content_type: 'text' }) } }
            )
          })}
          className="space-y-4"
        >
          <div>
            <label className="label">Lesson Title *</label>
            <input {...lessonForm.register('title', { required: true })} className="input" placeholder="e.g. Introduction to Variables" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Content Type</label>
              <select {...lessonForm.register('content_type')} className="input">
                <option value="text">Text</option>
                <option value="video">Video</option>
                <option value="embed">Embed</option>
                <option value="file">File</option>
              </select>
            </div>
            <div>
              <label className="label">Duration (min)</label>
              <input {...lessonForm.register('duration_min')} type="number" min="1" className="input" placeholder="Optional" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setAddLessonModuleId(null)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={creatingLesson} className="btn-primary flex-1">
              {creatingLesson ? 'Adding...' : 'Add Lesson'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function LessonList({ courseId, moduleId, onDelete }: { courseId: string; moduleId: string; onDelete: (id: string) => void }) {
  const { data: lessons, isLoading } = useQuery<Lesson[]>({
    queryKey: ['lessons', moduleId],
    queryFn: () => api.get(`/courses/${courseId}/modules/${moduleId}/lessons`).then((r) => r.data),
    enabled: !!moduleId,
  })

  if (isLoading) return <div className="px-4 py-3 text-sm text-gray-400">Loading...</div>

  return (
    <div className="divide-y divide-gray-100">
      {!lessons?.length && (
        <p className="px-4 py-3 text-sm text-gray-400">No lessons yet.</p>
      )}
      {lessons?.map((lesson) => (
        <div key={lesson.id} className="flex items-center gap-3 px-4 py-2.5">
          <GripVertical className="h-4 w-4 text-gray-200" />
          <span className="flex-1 text-sm text-gray-700">{lesson.title}</span>
          {lesson.duration_min && <span className="text-xs text-gray-400">{lesson.duration_min} min</span>}
          <span className="text-xs text-gray-400 capitalize">{lesson.content_type}</span>
          <button onClick={() => { if (confirm('Delete this lesson?')) onDelete(lesson.id) }} className="text-red-400 hover:text-red-600">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
