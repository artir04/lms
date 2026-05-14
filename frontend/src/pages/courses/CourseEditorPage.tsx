import { useParams, useNavigate } from 'react-router-dom'
import { useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Pencil, Trash2, GripVertical, ChevronDown, ChevronRight, Upload, Paperclip } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useCourse, useUpdateCourse } from '@/api/courses'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageLoader } from '@/components/ui/Spinner'
import { toast } from '@/store/toastStore'
import { ROUTES } from '@/config/routes'
import { cn } from '@/utils/cn'
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
  body?: string | null
  video_url?: string | null
  attachments?: { id: string; filename: string; url: string }[]
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

  const { mutate: deleteModule, isPending: deletingModule } = useMutation({
    mutationFn: (moduleId: string) => api.delete(`/courses/${courseId}/modules/${moduleId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modules', courseId] })
      toast.success('Module deleted')
    },
    onError: () => toast.error('Failed to delete module'),
  })

  const { mutate: createLesson, isPending: creatingLesson } = useMutation({
    mutationFn: ({ moduleId, data }: { moduleId: string; data: any }) =>
      api.post(`/courses/${courseId}/modules/${moduleId}/lessons`, data).then((r) => r.data),
    onSuccess: (_d, { moduleId }) => {
      qc.invalidateQueries({ queryKey: ['modules', courseId] })
      qc.invalidateQueries({ queryKey: ['lessons', moduleId] })
      toast.success('Lesson added')
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to add lesson'),
  })

  const { mutate: updateLesson, isPending: savingLesson } = useMutation({
    mutationFn: ({ lessonId, data }: { lessonId: string; moduleId: string; data: any }) =>
      api.patch(`/courses/${courseId}/lessons/${lessonId}`, data).then((r) => r.data),
    onSuccess: (_d, { moduleId }) => {
      qc.invalidateQueries({ queryKey: ['lessons', moduleId] })
      qc.invalidateQueries({ queryKey: ['lesson'] })
      toast.success('Lesson updated')
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to update lesson'),
  })

  const { mutate: deleteLesson, isPending: deletingLesson } = useMutation({
    mutationFn: ({ lessonId }: { lessonId: string; moduleId: string }) =>
      api.delete(`/courses/${courseId}/lessons/${lessonId}`),
    onSuccess: (_d, { moduleId }) => {
      qc.invalidateQueries({ queryKey: ['modules', courseId] })
      qc.invalidateQueries({ queryKey: ['lessons', moduleId] })
      toast.success('Lesson deleted')
    },
    onError: () => toast.error('Failed to delete lesson'),
  })

  const { mutate: reorderModules } = useMutation({
    mutationFn: (ordered_ids: string[]) =>
      api.put(
        `/courses/${courseId}/modules/reorder`,
        ordered_ids.map((id, position) => ({ id, position })),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modules', courseId] }),
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Reorder failed'),
  })

  const { mutate: reorderLessons } = useMutation({
    mutationFn: ({ moduleId, ordered_ids }: { moduleId: string; ordered_ids: string[] }) =>
      api.put(
        `/courses/${courseId}/modules/${moduleId}/lessons/reorder`,
        ordered_ids.map((id, position) => ({ id, position })),
      ),
    onSuccess: (_d, { moduleId }) => qc.invalidateQueries({ queryKey: ['lessons', moduleId] }),
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Reorder failed'),
  })

  // Drag state for modules
  const [dragModuleId, setDragModuleId] = useState<string | null>(null)
  const [dragOverModuleId, setDragOverModuleId] = useState<string | null>(null)

  const handleModuleDragStart = (e: React.DragEvent, moduleId: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', moduleId)
    setDragModuleId(moduleId)
  }

  const handleModuleDragOver = (e: React.DragEvent, moduleId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (moduleId !== dragModuleId) setDragOverModuleId(moduleId)
  }

  const handleModuleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!modules || !dragModuleId || dragModuleId === targetId) return
    const ordered = [...modules]
    const fromIdx = ordered.findIndex((m) => m.id === dragModuleId)
    const toIdx = ordered.findIndex((m) => m.id === targetId)
    const [moved] = ordered.splice(fromIdx, 1)
    ordered.splice(toIdx, 0, moved)
    reorderModules(ordered.map((m) => m.id))
    setDragModuleId(null)
    setDragOverModuleId(null)
  }

  const handleModuleDragEnd = () => {
    setDragModuleId(null)
    setDragOverModuleId(null)
  }

  // Modal states
  const [showEditCourse, setShowEditCourse] = useState(false)
  const [showAddModule, setShowAddModule] = useState(false)
  const [addLessonModuleId, setAddLessonModuleId] = useState<string | null>(null)
  const [editingLesson, setEditingLesson] = useState<{ lesson: Lesson; moduleId: string } | null>(null)
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [moduleToDelete, setModuleToDelete] = useState<Module | null>(null)
  const [lessonToDelete, setLessonToDelete] = useState<{ id: string; title: string; moduleId: string } | null>(null)

  const courseForm = useForm({ values: { title: course?.title || '', description: course?.description || '', subject: course?.subject || '', grade_level: course?.grade_level || '', is_published: course?.is_published ?? false } })
  const moduleForm = useForm<{ title: string }>()
  type LessonFormShape = { title: string; content_type: string; duration_min: string; body: string; video_url: string }
  const lessonForm = useForm<LessonFormShape>({
    defaultValues: { content_type: 'text', body: '', video_url: '' },
  })
  const editLessonForm = useForm<LessonFormShape>({
    defaultValues: { content_type: 'text', body: '', video_url: '' },
  })

  const toggleModule = (id: string) =>
    setExpandedModules((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  if (isLoading) return <PageLoader />
  if (!course) return <div className="text-center text-ink-muted py-16">Course not found</div>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(ROUTES.COURSE_DETAIL(courseId!))} className="text-ink-muted hover:text-ink-secondary transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-ink font-display">{course.title}</h1>
          <p className="text-sm text-ink-muted">{course.is_published ? 'Published' : 'Draft'}</p>
        </div>
        <button onClick={() => setShowEditCourse(true)} className="btn-secondary">
          <Pencil className="h-4 w-4" /> Edit Details
        </button>
      </div>

      {/* Modules */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink font-display">Course Content</h2>
            <p className="text-xs text-ink-muted mt-0.5">Drag modules and lessons to reorder them</p>
          </div>
          <button onClick={() => setShowAddModule(true)} className="btn-primary text-sm">
            <Plus className="h-4 w-4" /> Add Module
          </button>
        </div>

        {modulesLoading ? (
          <PageLoader />
        ) : !modules?.length ? (
          <div className="text-center text-ink-muted py-8">No modules yet. Add your first module above.</div>
        ) : (
          <div className="space-y-2">
            {modules.map((mod) => (
              <div
                key={mod.id}
                draggable
                onDragStart={(e) => handleModuleDragStart(e, mod.id)}
                onDragOver={(e) => handleModuleDragOver(e, mod.id)}
                onDrop={(e) => handleModuleDrop(e, mod.id)}
                onDragEnd={handleModuleDragEnd}
                className={cn(
                  'border rounded-xl overflow-hidden transition-all',
                  dragModuleId === mod.id
                    ? 'opacity-50 border-primary-500'
                    : dragOverModuleId === mod.id
                    ? 'border-primary-400 ring-1 ring-primary-400/30'
                    : 'border-border'
                )}
              >
                {/* Module header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-surface-elevated/50">
                  <GripVertical className="h-4 w-4 text-ink-muted cursor-grab active:cursor-grabbing shrink-0" />
                  <button onClick={() => toggleModule(mod.id)} className="flex-1 flex items-center gap-2 text-left">
                    {expandedModules.has(mod.id) ? (
                      <ChevronDown className="h-4 w-4 text-ink-muted" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-ink-muted" />
                    )}
                    <span className="font-medium text-ink">{mod.title}</span>
                    <span className="text-xs text-ink-muted ml-1">({mod.lesson_count} lessons)</span>
                  </button>
                  <button
                    onClick={() => { setAddLessonModuleId(mod.id); lessonForm.reset({ content_type: 'text' }) }}
                    className="text-xs text-primary-400 hover:underline"
                  >
                    + Lesson
                  </button>
                  <button onClick={() => setModuleToDelete(mod)} className="text-red-400 hover:text-red-300 ml-1">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Lessons */}
                {expandedModules.has(mod.id) && (
                  <LessonList
                    courseId={courseId!}
                    moduleId={mod.id}
                    onDelete={(lesson) => setLessonToDelete({ id: lesson.id, title: lesson.title, moduleId: mod.id })}
                    onEdit={(lesson) => {
                      editLessonForm.reset({
                        title: lesson.title,
                        content_type: lesson.content_type,
                        duration_min: lesson.duration_min ? String(lesson.duration_min) : '',
                        body: lesson.body ?? '',
                        video_url: lesson.video_url ?? '',
                      })
                      setEditingLesson({ lesson, moduleId: mod.id })
                    }}
                    onReorder={(ordered_ids) => reorderLessons({ moduleId: mod.id, ordered_ids })}
                  />
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
            <label htmlFor="is_published" className="text-sm text-ink-secondary">Published (visible to students)</label>
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

      {/* Confirm: delete module */}
      <ConfirmDialog
        isOpen={!!moduleToDelete}
        onClose={() => setModuleToDelete(null)}
        onConfirm={() => {
          if (!moduleToDelete) return
          deleteModule(moduleToDelete.id, { onSettled: () => setModuleToDelete(null) })
        }}
        title="Delete module?"
        description={
          moduleToDelete
            ? `"${moduleToDelete.title}" and its ${moduleToDelete.lesson_count} lesson${moduleToDelete.lesson_count === 1 ? '' : 's'} will be permanently deleted.`
            : ''
        }
        confirmLabel="Delete module"
        loading={deletingModule}
      />

      {/* Confirm: delete lesson */}
      <ConfirmDialog
        isOpen={!!lessonToDelete}
        onClose={() => setLessonToDelete(null)}
        onConfirm={() => {
          if (!lessonToDelete) return
          deleteLesson(
            { lessonId: lessonToDelete.id, moduleId: lessonToDelete.moduleId },
            { onSettled: () => setLessonToDelete(null) },
          )
        }}
        title="Delete lesson?"
        description={
          lessonToDelete ? `"${lessonToDelete.title}" will be permanently deleted, including any attachments.` : ''
        }
        confirmLabel="Delete lesson"
        loading={deletingLesson}
      />

      {/* Add Lesson Modal */}
      <Modal isOpen={!!addLessonModuleId} onClose={() => setAddLessonModuleId(null)} title="Add Lesson" size="lg">
        <LessonFormFields
          form={lessonForm}
          submitting={creatingLesson}
          submitLabel="Add Lesson"
          onCancel={() => setAddLessonModuleId(null)}
          onSubmit={(d) => {
            createLesson(
              {
                moduleId: addLessonModuleId!,
                data: {
                  title: d.title,
                  content_type: d.content_type,
                  duration_min: d.duration_min ? Number(d.duration_min) : null,
                  body: d.body || null,
                  video_url: d.video_url || null,
                },
              },
              { onSuccess: () => { setAddLessonModuleId(null); lessonForm.reset({ content_type: 'text', body: '', video_url: '' }) } }
            )
          }}
        />
      </Modal>

      {/* Edit Lesson Modal */}
      <Modal isOpen={!!editingLesson} onClose={() => setEditingLesson(null)} title="Edit Lesson" size="lg">
        {editingLesson && (
          <LessonFormFields
            form={editLessonForm}
            submitting={savingLesson}
            submitLabel="Save changes"
            onCancel={() => setEditingLesson(null)}
            onSubmit={(d) => {
              updateLesson(
                {
                  lessonId: editingLesson.lesson.id,
                  moduleId: editingLesson.moduleId,
                  data: {
                    title: d.title,
                    content_type: d.content_type,
                    duration_min: d.duration_min ? Number(d.duration_min) : null,
                    body: d.body || null,
                    video_url: d.video_url || null,
                  },
                },
                { onSuccess: () => setEditingLesson(null) }
              )
            }}
          />
        )}
      </Modal>
    </div>
  )
}

function LessonFormFields({
  form,
  onSubmit,
  onCancel,
  submitting,
  submitLabel,
}: {
  form: ReturnType<typeof useForm<{ title: string; content_type: string; duration_min: string; body: string; video_url: string }>>
  onSubmit: (data: { title: string; content_type: string; duration_min: string; body: string; video_url: string }) => void
  onCancel: () => void
  submitting: boolean
  submitLabel: string
}) {
  const contentType = form.watch('content_type')
  const showBody = contentType === 'text'
  const showVideoUrl = contentType === 'video' || contentType === 'embed'

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="label">Lesson Title *</label>
        <input {...form.register('title', { required: true })} className="input" placeholder="e.g. Introduction to Variables" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Content Type</label>
          <select {...form.register('content_type')} className="input">
            <option value="text">Text</option>
            <option value="video">Video</option>
            <option value="embed">Embed</option>
            <option value="file">File</option>
          </select>
        </div>
        <div>
          <label className="label">Duration (min)</label>
          <input {...form.register('duration_min')} type="number" min="1" className="input" placeholder="Optional" />
        </div>
      </div>
      {showBody && (
        <div>
          <label className="label">Lesson body</label>
          <textarea
            {...form.register('body')}
            rows={10}
            className="input resize-y font-mono text-sm"
            placeholder="Write the lesson content here. Basic HTML is supported (e.g. <h2>, <p>, <ul>, <strong>, <a href=...>)."
          />
          <p className="text-[11px] text-ink-muted mt-1">
            Plain text or HTML. Students will see this rendered on the lesson page.
          </p>
        </div>
      )}
      {showVideoUrl && (
        <div>
          <label className="label">{contentType === 'embed' ? 'Embed URL' : 'Video URL'}</label>
          <input
            {...form.register('video_url')}
            type="url"
            className="input"
            placeholder={contentType === 'embed' ? 'https://example.com/embed/...' : 'https://youtube.com/embed/...'}
          />
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={submitting} className="btn-primary flex-1">
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

function LessonList({
  courseId,
  moduleId,
  onDelete,
  onEdit,
  onReorder,
}: {
  courseId: string
  moduleId: string
  onDelete: (lesson: Lesson) => void
  onEdit: (lesson: Lesson) => void
  onReorder: (ordered_ids: string[]) => void
}) {
  const { data: lessons, isLoading } = useQuery<Lesson[]>({
    queryKey: ['lessons', moduleId],
    queryFn: () => api.get(`/courses/${courseId}/modules/${moduleId}/lessons`).then((r) => r.data),
    enabled: !!moduleId,
  })

  const [dragLessonId, setDragLessonId] = useState<string | null>(null)
  const [dragOverLessonId, setDragOverLessonId] = useState<string | null>(null)
  const [uploadingLessonId, setUploadingLessonId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const { mutate: uploadAttachment, isPending: uploading } = useMutation({
    mutationFn: ({ lessonId, file }: { lessonId: string; file: File }) => {
      const fd = new FormData()
      fd.append('file', file)
      return api.post(`/courses/${courseId}/lessons/${lessonId}/attachments`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data)
    },
    onSuccess: (_data, { file }) => {
      qc.invalidateQueries({ queryKey: ['lessons', moduleId] })
      qc.invalidateQueries({ queryKey: ['lesson'] })
      toast.success(`Uploaded ${file.name}`)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Upload failed')
    },
  })

  const handleLessonDragStart = (e: React.DragEvent, lessonId: string) => {
    e.stopPropagation()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('lesson', lessonId)
    setDragLessonId(lessonId)
  }

  const handleLessonDragOver = (e: React.DragEvent, lessonId: string) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (lessonId !== dragLessonId) setDragOverLessonId(lessonId)
  }

  const handleLessonDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!lessons || !dragLessonId || dragLessonId === targetId) return
    const ordered = [...lessons]
    const fromIdx = ordered.findIndex((l) => l.id === dragLessonId)
    const toIdx = ordered.findIndex((l) => l.id === targetId)
    const [moved] = ordered.splice(fromIdx, 1)
    ordered.splice(toIdx, 0, moved)
    onReorder(ordered.map((l) => l.id))
    setDragLessonId(null)
    setDragOverLessonId(null)
  }

  const handleLessonDragEnd = () => {
    setDragLessonId(null)
    setDragOverLessonId(null)
  }

  if (isLoading) return <div className="px-4 py-3 text-sm text-ink-muted">Loading...</div>

  return (
    <div className="divide-y divide-border/60">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file && uploadingLessonId) {
            uploadAttachment({ lessonId: uploadingLessonId, file })
          }
          e.target.value = ''
        }}
      />
      {!lessons?.length && (
        <p className="px-4 py-3 text-sm text-ink-muted">No lessons yet.</p>
      )}
      {lessons?.map((lesson) => {
        const isUploadingHere = uploading && uploadingLessonId === lesson.id
        return (
          <div key={lesson.id}>
            <div
              draggable
              onDragStart={(e) => handleLessonDragStart(e, lesson.id)}
              onDragOver={(e) => handleLessonDragOver(e, lesson.id)}
              onDrop={(e) => handleLessonDrop(e, lesson.id)}
              onDragEnd={handleLessonDragEnd}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 transition-colors',
                dragLessonId === lesson.id
                  ? 'opacity-50 bg-primary-500/5'
                  : dragOverLessonId === lesson.id
                  ? 'bg-primary-500/10'
                  : ''
              )}
            >
              <GripVertical className="h-4 w-4 text-ink-muted cursor-grab active:cursor-grabbing shrink-0" />
              <span className="flex-1 text-sm text-ink-secondary truncate">{lesson.title}</span>
              {lesson.duration_min && <span className="text-xs text-ink-muted">{lesson.duration_min} min</span>}
              <span className="text-xs text-ink-muted capitalize">{lesson.content_type}</span>
              {lesson.attachments && lesson.attachments.length > 0 && (
                <span className="text-xs text-ink-muted flex items-center gap-0.5" title={`${lesson.attachments.length} attachment(s)`}>
                  <Paperclip className="h-3 w-3" />
                  {lesson.attachments.length}
                </span>
              )}
              {lesson.content_type !== 'text' && (
                <button
                  onClick={() => {
                    setUploadingLessonId(lesson.id)
                    fileInputRef.current?.click()
                  }}
                  disabled={isUploadingHere}
                  className="text-ink-muted hover:text-primary-400 transition-colors disabled:opacity-50"
                  title={isUploadingHere ? 'Uploading…' : 'Upload attachment'}
                >
                  <Upload className={cn('h-3.5 w-3.5', isUploadingHere && 'animate-pulse')} />
                </button>
              )}
              <button
                onClick={() => onEdit(lesson)}
                className="text-ink-muted hover:text-primary-400 transition-colors"
                title="Edit lesson"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => onDelete(lesson)} className="text-red-400 hover:text-red-300">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {lesson.attachments && lesson.attachments.length > 0 && (
              <ul className="pl-12 pr-4 pb-2 space-y-1">
                {lesson.attachments.map((att) => (
                  <li key={att.id} className="flex items-center gap-2 text-xs text-ink-muted">
                    <Paperclip className="h-3 w-3 shrink-0" />
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate hover:text-primary-400 transition-colors"
                    >
                      {att.filename}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
