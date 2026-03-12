import { useParams, Link, useNavigate } from 'react-router-dom'
import { BookOpen, ChevronDown, ChevronRight, PlayCircle, FileText, Link2, Plus } from 'lucide-react'
import { useState } from 'react'
import { useCourse } from '@/api/courses'
import { useQuizzes, useCreateQuiz } from '@/api/assessments'
import { Modal } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/config/routes'
import { formatDate } from '@/utils/formatters'
import api from '@/config/axios'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'

export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>()!
  const { isTeacher, isAdmin } = useAuth()
  const { data: course, isLoading } = useCourse(courseId!)
  const { data: quizzes } = useQuizzes(courseId!)
  const [openModules, setOpenModules] = useState<Set<string>>(new Set())

  const { data: modules } = useQuery({
    queryKey: ['modules', courseId],
    queryFn: () => api.get(`/courses/${courseId}/modules`).then((r) => r.data),
    enabled: !!courseId,
  })

  if (isLoading) return <PageLoader />
  if (!course) return <div className="text-center text-gray-500 py-16">Course not found</div>

  const toggleModule = (id: string) => {
    setOpenModules((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const contentTypeIcon = (type: string) => {
    if (type === 'video') return <PlayCircle className="h-4 w-4 text-blue-500" />
    if (type === 'embed') return <Link2 className="h-4 w-4 text-purple-500" />
    return <FileText className="h-4 w-4 text-gray-400" />
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              {course.subject && <span className="badge badge-blue">{course.subject}</span>}
              {course.grade_level && <span className="badge badge-gray">Grade {course.grade_level}</span>}
              <span className={`badge ${course.is_published ? 'badge-green' : 'badge-yellow'}`}>
                {course.is_published ? 'Published' : 'Draft'}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
            {course.description && <p className="mt-2 text-gray-600">{course.description}</p>}
            <p className="mt-3 text-sm text-gray-500">Teacher: {course.teacher.full_name}</p>
          </div>
          {(isTeacher || isAdmin) && (
            <div className="flex gap-2">
              <Link to={ROUTES.GRADEBOOK(courseId!)} className="btn-secondary text-sm">
                Gradebook
              </Link>
              <Link to={ROUTES.COURSE_EDITOR(courseId!)} className="btn-secondary text-sm">
                Edit Course
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Modules */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Course Content</h2>
        </div>

        <div className="space-y-2">
          {(modules as any[])?.map((module: any) => (
            <div key={module.id} className="card overflow-hidden">
              <button
                onClick={() => toggleModule(module.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <span className="font-medium text-gray-900">{module.title}</span>
                {openModules.has(module.id) ? (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                )}
              </button>

              {openModules.has(module.id) && (
                <div className="border-t border-gray-100">
                  {module.lessons?.map((lesson: any) => (
                    <Link
                      key={lesson.id}
                      to={ROUTES.LESSON(courseId!, lesson.id)}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                    >
                      {contentTypeIcon(lesson.content_type)}
                      <span className="text-sm text-gray-700">{lesson.title}</span>
                      {lesson.duration_min && (
                        <span className="ml-auto text-xs text-gray-400">{lesson.duration_min} min</span>
                      )}
                    </Link>
                  ))}
                  {!module.lessons?.length && (
                    <p className="px-5 py-3 text-sm text-gray-400">No lessons yet.</p>
                  )}
                </div>
              )}
            </div>
          ))}
          {!modules?.length && (
            <div className="card p-8 text-center text-gray-400">
              <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No content yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Quizzes */}
      {((isTeacher || isAdmin) || (quizzes && quizzes.length > 0)) && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Quizzes & Assignments</h2>
            {(isTeacher || isAdmin) && (
              <CreateQuizButton courseId={courseId!} />
            )}
          </div>
          <div className="space-y-2">
            {quizzes?.map((quiz) => (
              <div key={quiz.id} className="card flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-medium text-gray-900">{quiz.title}</p>
                  <p className="text-sm text-gray-500">
                    {quiz.question_count} questions · {quiz.total_points} points
                    {quiz.due_at && ` · Due ${formatDate(quiz.due_at)}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {(isTeacher || isAdmin) && (
                    <Link to={ROUTES.QUIZ_BUILDER(courseId!, quiz.id)} className="btn-secondary text-sm">
                      Build
                    </Link>
                  )}
                  <Link to={ROUTES.QUIZ_TAKE(quiz.id)} className="btn-primary text-sm">
                    Start
                  </Link>
                </div>
              </div>
            ))}
            {!quizzes?.length && (
              <p className="text-gray-400 text-sm py-4">No quizzes yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CreateQuizButton({ courseId }: { courseId: string }) {
  const navigate = useNavigate()
  const [show, setShow] = useState(false)
  const { mutate: createQuiz, isPending } = useCreateQuiz(courseId)
  const { register, handleSubmit, reset } = useForm<{ title: string }>()

  return (
    <>
      <button onClick={() => setShow(true)} className="btn-primary text-sm">
        <Plus className="h-4 w-4" /> New Quiz
      </button>
      <Modal isOpen={show} onClose={() => setShow(false)} title="Create Quiz">
        <form
          onSubmit={handleSubmit((d) =>
            createQuiz(d, {
              onSuccess: (quiz: any) => {
                setShow(false)
                reset()
                navigate(ROUTES.QUIZ_BUILDER(courseId, quiz.id))
              },
            })
          )}
          className="space-y-4"
        >
          <div>
            <label className="label">Quiz Title *</label>
            <input {...register('title', { required: true })} className="input" placeholder="e.g. Chapter 1 Quiz" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShow(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1">
              {isPending ? 'Creating...' : 'Create & Build'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
