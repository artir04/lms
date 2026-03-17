import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  BookOpen, ChevronDown, ChevronRight, PlayCircle, FileText, Link2,
  Plus, ClipboardList, Info, User, CalendarDays, Clock, Award,
  LayoutList, Pencil, BookMarked,
} from 'lucide-react'
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

type Tab = 'content' | 'quizzes' | 'details'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'content',  label: 'Course Content', icon: <LayoutList className="h-4 w-4" /> },
  { id: 'quizzes',  label: 'Quizzes',        icon: <ClipboardList className="h-4 w-4" /> },
  { id: 'details',  label: 'Details',        icon: <Info className="h-4 w-4" /> },
]

export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>()!
  const { isTeacher, isAdmin } = useAuth()
  const { data: course, isLoading } = useCourse(courseId!)
  const { data: quizzes } = useQuizzes(courseId!)
  const [tab, setTab] = useState<Tab>('content')
  const [openModules, setOpenModules] = useState<Set<string>>(new Set())

  const { data: modules } = useQuery({
    queryKey: ['modules', courseId],
    queryFn: () => api.get(`/courses/${courseId}/modules`).then((r) => r.data),
    enabled: !!courseId,
  })

  if (isLoading) return <PageLoader />
  if (!course) return <div className="text-center text-slate-500 py-16">Course not found</div>

  const toggleModule = (id: string) => {
    setOpenModules((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const contentTypeIcon = (type: string) => {
    if (type === 'video') return <PlayCircle className="h-4 w-4 text-indigo-500" />
    if (type === 'embed') return <Link2 className="h-4 w-4 text-purple-500" />
    return <FileText className="h-4 w-4 text-slate-400" />
  }

  const totalLessons = (modules as any[])?.reduce(
    (acc: number, m: any) => acc + (m.lessons?.length ?? 0), 0
  ) ?? 0

  return (
    <div className="max-w-4xl mx-auto">
      {/* ── Course Hero ─────────────────────────────── */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700/70 shadow-card rounded-b-none border-b-0">
        {/* Gradient accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-t-2xl" />

        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {course.subject && <span className="badge badge-blue">{course.subject}</span>}
                {course.grade_level && <span className="badge badge-gray">Grade {course.grade_level}</span>}
                <span className={`badge ${course.is_published ? 'badge-green' : 'badge-yellow'}`}>
                  {course.is_published ? 'Published' : 'Draft'}
                </span>
              </div>

              <h1 className="text-2xl font-bold text-white">{course.title}</h1>

              {/* Quick stats */}
              <div className="flex flex-wrap items-center gap-5 mt-3 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  {course.teacher.full_name}
                </span>
                <span className="flex items-center gap-1.5">
                  <BookMarked className="h-4 w-4" />
                  {(modules as any[])?.length ?? 0} modules · {totalLessons} lessons
                </span>
                <span className="flex items-center gap-1.5">
                  <ClipboardList className="h-4 w-4" />
                  {quizzes?.length ?? 0} quizzes
                </span>
              </div>
            </div>

            {/* Teacher/Admin actions */}
            {(isTeacher || isAdmin) && (
              <div className="flex gap-2 flex-shrink-0">
                <Link to={ROUTES.COURSE_ATTENDANCE(courseId!)} className="btn-secondary btn-sm">
                  <CalendarDays className="h-3.5 w-3.5" /> Attendance
                </Link>
                <Link to={ROUTES.GRADEBOOK(courseId!)} className="btn-secondary btn-sm">
                  <Award className="h-3.5 w-3.5" /> Gradebook
                </Link>
                <Link to={ROUTES.COURSE_EDITOR(courseId!)} className="btn-secondary btn-sm">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ── Tab strip ──────────────────────────────── */}
        <div className="border-t border-slate-100 px-6 flex gap-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                'flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === t.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
              ].join(' ')}
            >
              {t.icon}
              {t.label}
              {t.id === 'quizzes' && quizzes && quizzes.length > 0 && (
                <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-1.5 py-0.5 font-semibold leading-none">
                  {quizzes.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab panels ──────────────────────────────── */}
      <div className="pt-4 space-y-3">

        {/* CONTENT TAB */}
        {tab === 'content' && (
          <>
            {(modules as any[])?.map((module: any, idx: number) => (
              <div key={module.id} className="card overflow-hidden">
                <button
                  onClick={() => toggleModule(module.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-700/30 transition-colors"
                >
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="flex-1 text-left font-medium text-slate-100">{module.title}</span>
                  <span className="text-xs text-slate-400 mr-1">{module.lessons?.length ?? 0} lessons</span>
                  {openModules.has(module.id)
                    ? <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  }
                </button>

                {openModules.has(module.id) && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {module.lessons?.map((lesson: any) => (
                      <Link
                        key={lesson.id}
                        to={ROUTES.LESSON(courseId!, lesson.id)}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-slate-700/30 transition-colors"
                      >
                        <span className="flex-shrink-0 pl-1">{contentTypeIcon(lesson.content_type)}</span>
                        <span className="flex-1 text-sm text-slate-700">{lesson.title}</span>
                        {lesson.duration_min && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Clock className="h-3 w-3" />
                            {lesson.duration_min} min
                          </span>
                        )}
                      </Link>
                    ))}
                    {!module.lessons?.length && (
                      <p className="px-5 py-3 text-sm text-slate-400 italic">No lessons in this module yet.</p>
                    )}
                  </div>
                )}
              </div>
            ))}

            {!modules?.length && (
              <div className="card p-12 text-center text-slate-400">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No content yet</p>
                <p className="text-sm mt-1">
                  {(isTeacher || isAdmin)
                    ? 'Go to Edit to add modules and lessons.'
                    : 'Check back later for course materials.'}
                </p>
              </div>
            )}
          </>
        )}

        {/* QUIZZES TAB */}
        {tab === 'quizzes' && (
          <>
            <div className="flex items-center justify-between px-1 mb-1">
              <p className="text-sm text-slate-500">
                {quizzes?.length
                  ? `${quizzes.length} quiz${quizzes.length !== 1 ? 'zes' : ''} in this course`
                  : ''}
              </p>
              {(isTeacher || isAdmin) && <CreateQuizButton courseId={courseId!} />}
            </div>

            {quizzes?.map((quiz) => (
              <div key={quiz.id} className="card px-5 py-4 flex items-center gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white">{quiz.title}</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {quiz.question_count} question{quiz.question_count !== 1 ? 's' : ''}
                    {' · '}{quiz.total_points} pts
                    {quiz.time_limit_min && ` · ${quiz.time_limit_min} min`}
                    {quiz.due_at && (
                      <span className="ml-1 text-rose-500 font-medium">· Due {formatDate(quiz.due_at)}</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {(isTeacher || isAdmin) ? (
                    <Link to={ROUTES.QUIZ_BUILDER(courseId!, quiz.id)} className="btn-secondary btn-sm">
                      <Pencil className="h-3.5 w-3.5" /> Build
                    </Link>
                  ) : quiz.is_published ? (
                    <Link to={ROUTES.QUIZ_TAKE(quiz.id)} className="btn-primary btn-sm">
                      Start
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-400 italic px-2">Not available</span>
                  )}
                </div>
              </div>
            ))}

            {!quizzes?.length && (
              <div className="card p-12 text-center text-slate-400">
                <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No quizzes yet</p>
                <p className="text-sm mt-1">
                  {(isTeacher || isAdmin)
                    ? 'Create your first quiz using the button above.'
                    : "Your teacher hasn't added any quizzes yet."}
                </p>
              </div>
            )}
          </>
        )}

        {/* DETAILS TAB */}
        {tab === 'details' && (
          <div className="card divide-y divide-slate-100">
            <div className="p-6">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">About</h3>
              <p className="text-slate-700 text-sm leading-relaxed">
                {course.description || 'No description provided.'}
              </p>
            </div>

            <div className="p-6">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Instructor</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0">
                  {course.teacher.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-white">{course.teacher.full_name}</p>
                  <p className="text-xs text-slate-400">{course.teacher.email}</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Course Info</h3>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                {course.subject && (
                  <div>
                    <dt className="text-xs text-slate-400 mb-0.5">Subject</dt>
                    <dd className="text-sm font-medium text-slate-100">{course.subject}</dd>
                  </div>
                )}
                {course.grade_level && (
                  <div>
                    <dt className="text-xs text-slate-400 mb-0.5">Grade level</dt>
                    <dd className="text-sm font-medium text-slate-100">Grade {course.grade_level}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-slate-400 mb-0.5">Status</dt>
                  <dd>
                    <span className={`badge ${course.is_published ? 'badge-green' : 'badge-yellow'}`}>
                      {course.is_published ? 'Published' : 'Draft'}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400 mb-0.5">Modules</dt>
                  <dd className="text-sm font-medium text-slate-100">{(modules as any[])?.length ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400 mb-0.5">Lessons</dt>
                  <dd className="text-sm font-medium text-slate-100">{totalLessons}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400 mb-0.5">Quizzes</dt>
                  <dd className="text-sm font-medium text-slate-100">{quizzes?.length ?? 0}</dd>
                </div>
                {course.created_at && (
                  <div>
                    <dt className="text-xs text-slate-400 mb-0.5">Created</dt>
                    <dd className="text-sm font-medium text-slate-100 flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                      {formatDate(course.created_at)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        )}
      </div>
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
      <button onClick={() => setShow(true)} className="btn-primary btn-sm">
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
