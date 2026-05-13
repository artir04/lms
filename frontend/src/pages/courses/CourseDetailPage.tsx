import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  BookOpen, ChevronDown, ChevronRight, PlayCircle, FileText, Link2,
  Plus, ClipboardList, CalendarDays, Clock, Award,
  Pencil, BookMarked, Layers, ArrowRight, Users, GraduationCap,
  Mail, CheckCircle2, Paperclip, Download, Upload, ClipboardCheck,
} from 'lucide-react'
import { useState } from 'react'
import { useCourse } from '@/api/courses'
import { useQuizzes, useCreateQuiz } from '@/api/assessments'
import { useAssignments, useCreateAssignment } from '@/api/assignments'
import { Modal } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/config/routes'
import { formatDate } from '@/utils/formatters'
import api from '@/config/axios'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useGradebook, useMyGrades } from '@/api/grades'

type Tab = 'content' | 'classlist' | 'quizzes' | 'assignments' | 'grades'
const TAB_VALUES: Tab[] = ['content', 'classlist', 'quizzes', 'assignments', 'grades']

export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>()!
  const { isTeacher, isAdmin } = useAuth()
  const { data: course, isLoading } = useCourse(courseId!)
  const { data: quizzes } = useQuizzes(courseId!)
  const { data: assignments } = useAssignments(courseId!)
  const [searchParams, setSearchParams] = useSearchParams()
  const paramTab = searchParams.get('tab') as Tab | null
  const tab: Tab = paramTab && TAB_VALUES.includes(paramTab) ? paramTab : 'content'
  const setTab = (next: Tab) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (next === 'content') params.delete('tab')
        else params.set('tab', next)
        return params
      },
      { replace: true },
    )
  }
  const [openModules, setOpenModules] = useState<Set<string>>(new Set())

  const { data: modules } = useQuery({
    queryKey: ['modules', courseId],
    queryFn: () => api.get(`/courses/${courseId}/modules`).then((r) => r.data),
    enabled: !!courseId,
  })

  const { data: students } = useQuery<any[]>({
    queryKey: ['students', courseId],
    queryFn: () => api.get(`/courses/${courseId}/enrollments`).then((r) => r.data),
    enabled: !!courseId,
  })

  if (isLoading) return <PageLoader />
  if (!course) return <div className="text-center text-ink-muted py-16">Course not found</div>

  const toggleModule = (id: string) => {
    setOpenModules((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const contentTypeIcon = (type: string) => {
    if (type === 'video') return <PlayCircle className="h-4 w-4 text-primary-400" />
    if (type === 'embed') return <Link2 className="h-4 w-4 text-purple-400" />
    return <FileText className="h-4 w-4 text-ink-muted" />
  }

  const totalLessons = (modules as any[])?.reduce(
    (acc: number, m: any) => acc + (m.lessons?.length ?? 0), 0
  ) ?? 0

  const canManage = isTeacher || isAdmin

  const TABS: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'content', label: 'Content', icon: <Layers className="h-4 w-4" /> },
    { id: 'classlist', label: 'Class List', icon: <Users className="h-4 w-4" />, count: students?.length },
    { id: 'quizzes', label: 'Quizzes', icon: <ClipboardList className="h-4 w-4" />, count: quizzes?.length },
    { id: 'assignments', label: 'Assignments', icon: <FileText className="h-4 w-4" />, count: assignments?.length },
    { id: 'grades', label: 'Grades', icon: <GraduationCap className="h-4 w-4" /> },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">

      {/* ─── COURSE HEADER ─── */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-surface-elevated animate-fade-in">
        {/* Decorative gradient */}
        <div className="absolute inset-0 opacity-40 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-primary-500/20 blur-[100px]" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-indigo-500/15 blur-[80px]" />
        </div>

        <div className="relative px-8 pt-10 pb-8 sm:px-10 sm:pt-12 sm:pb-10">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2.5 mb-5 animate-fade-up stagger-1">
            {course.subject && <span className="badge badge-blue">{course.subject}</span>}
            {course.grade_level && <span className="badge badge-gray">Grade {course.grade_level}</span>}
            <span className={`badge ${course.is_published ? 'badge-green' : 'badge-yellow'}`}>
              {course.is_published ? 'Published' : 'Draft'}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink font-display leading-tight tracking-tight mb-4 animate-fade-up stagger-2">
            {course.title}
          </h1>

          {/* Description */}
          {course.description && (
            <p className="text-ink-secondary text-base leading-relaxed max-w-2xl mb-6 animate-fade-up stagger-3">
              {course.description}
            </p>
          )}

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-ink-secondary animate-fade-up stagger-4">
            <span className="flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-ink-muted" />
              {(modules as any[])?.length ?? 0} modules
            </span>
            <span className="flex items-center gap-1.5">
              <BookMarked className="h-4 w-4 text-ink-muted" />
              {totalLessons} lessons
            </span>
            <span className="flex items-center gap-1.5">
              <ClipboardList className="h-4 w-4 text-ink-muted" />
              {quizzes?.length ?? 0} quizzes
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-ink-muted" />
              {students?.length ?? 0} students
            </span>
            {course.created_at && (
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-ink-muted" />
                {formatDate(course.created_at)}
              </span>
            )}
          </div>
        </div>

        {/* Management actions */}
        {canManage && (
          <div className="relative border-t border-border px-8 py-4 sm:px-10 flex flex-wrap gap-3 bg-surface/60">
            <Link to={ROUTES.COURSE_ATTENDANCE(courseId!)} className="btn-secondary btn-sm">
              <CalendarDays className="h-3.5 w-3.5" /> Attendance
            </Link>
            <Link to={ROUTES.GRADEBOOK(courseId!)} className="btn-secondary btn-sm">
              <Award className="h-3.5 w-3.5" /> Gradebook
            </Link>
            <Link to={ROUTES.COURSE_EDITOR(courseId!)} className="btn-secondary btn-sm">
              <Pencil className="h-3.5 w-3.5" /> Edit Course
            </Link>
          </div>
        )}
      </section>

      {/* ─── TAB NAVIGATION ─── */}
      <nav className="flex gap-1 p-1 rounded-xl bg-surface-elevated border border-border animate-fade-up stagger-5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center',
              tab === t.id
                ? 'bg-primary-500/15 text-primary-400 shadow-sm'
                : 'text-ink-muted hover:text-ink-secondary hover:bg-surface-overlay',
            ].join(' ')}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
            {t.count !== undefined && t.count > 0 && (
              <span className={[
                'text-xs rounded-full px-1.5 py-0.5 font-semibold leading-none',
                tab === t.id
                  ? 'bg-primary-500/20 text-primary-400'
                  : 'bg-surface-overlay text-ink-muted',
              ].join(' ')}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* ─── TAB CONTENT ─── */}

      {/* CONTENT TAB */}
      {tab === 'content' && (
        <section className="space-y-3 animate-fade-up">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-ink-muted">
              {(modules as any[])?.length ?? 0} modules · {totalLessons} lessons
            </p>
          </div>

          {(modules as any[])?.map((module: any, idx: number) => (
            <div key={module.id} className="card overflow-hidden">
              <button
                onClick={() => toggleModule(module.id)}
                className="w-full flex items-center gap-4 px-6 py-5 hover:bg-surface-elevated transition-colors"
              >
                <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary-500/15 text-primary-400 text-sm font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <div className="flex-1 text-left">
                  <span className="font-semibold text-ink block">{module.title}</span>
                  <span className="text-xs text-ink-muted mt-0.5 block">
                    {module.lessons?.length ?? 0} lesson{(module.lessons?.length ?? 0) !== 1 ? 's' : ''}
                  </span>
                </div>
                {openModules.has(module.id)
                  ? <ChevronDown className="h-5 w-5 text-ink-muted flex-shrink-0" />
                  : <ChevronRight className="h-5 w-5 text-ink-muted flex-shrink-0" />
                }
              </button>

              {openModules.has(module.id) && (
                <div className="border-t border-border">
                  {module.lessons?.map((lesson: any) => (
                    <div
                      key={lesson.id}
                      className="border-b border-border/50 last:border-b-0"
                    >
                      <Link
                        to={ROUTES.LESSON(courseId!, lesson.id)}
                        className="flex items-center gap-4 px-6 py-4 hover:bg-surface-elevated transition-colors group"
                      >
                        <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-surface-overlay flex items-center justify-center group-hover:bg-primary-500/10 transition-colors">
                          {contentTypeIcon(lesson.content_type)}
                        </span>
                        <span className="flex-1 text-sm text-ink-secondary group-hover:text-ink transition-colors">
                          {lesson.title}
                        </span>
                        {lesson.attachments?.length > 0 && (
                          <span className="flex items-center gap-1 text-xs text-ink-muted" title={`${lesson.attachments.length} attachment(s)`}>
                            <Paperclip className="h-3 w-3" />
                            {lesson.attachments.length}
                          </span>
                        )}
                        {lesson.duration_min && (
                          <span className="flex items-center gap-1 text-xs text-ink-muted">
                            <Clock className="h-3 w-3" />
                            {lesson.duration_min} min
                          </span>
                        )}
                        <ArrowRight className="h-4 w-4 text-ink-faint group-hover:text-primary-400 transition-colors flex-shrink-0" />
                      </Link>
                      {/* Attachments visible inline */}
                      {lesson.attachments?.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 px-6 pb-3 pl-[4.25rem]">
                          {lesson.attachments.map((att: any) => (
                            <a
                              key={att.id}
                              href={att.download_url || att.url}
                              download
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 text-xs bg-surface-overlay hover:bg-primary-500/10 text-ink-muted hover:text-primary-400 rounded-md px-2.5 py-1 transition-colors"
                              title="Download"
                            >
                              <Download className="h-3 w-3" />
                              {att.filename}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {!module.lessons?.length && (
                    <p className="px-6 py-5 text-sm text-ink-muted italic">No lessons in this module yet.</p>
                  )}
                </div>
              )}
            </div>
          ))}

          {!modules?.length && (
            <div className="card p-16 text-center">
              <BookOpen className="h-14 w-14 mx-auto mb-4 text-ink-faint" />
              <p className="font-semibold text-ink mb-1">No content yet</p>
              <p className="text-sm text-ink-muted">
                {canManage
                  ? 'Go to Edit to add modules and lessons.'
                  : 'Check back later for course materials.'}
              </p>
            </div>
          )}
        </section>
      )}

      {/* CLASS LIST TAB */}
      {tab === 'classlist' && (
        <section className="space-y-6 animate-fade-up">
          {/* Instructor card */}
          <div>
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">Instructor</h3>
            <div className="card px-6 py-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary-500/20 border border-primary-500/30 flex items-center justify-center text-primary-400 font-bold text-lg flex-shrink-0">
                {course.teacher.full_name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink">{course.teacher.full_name}</p>
                <p className="text-sm text-ink-muted flex items-center gap-1.5 mt-0.5">
                  <Mail className="h-3.5 w-3.5" />
                  {course.teacher.email}
                </p>
              </div>
              <span className="badge badge-purple">Instructor</span>
            </div>
          </div>

          {/* Students list */}
          <div>
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">
              Students ({students?.length ?? 0})
            </h3>

            {students && students.length > 0 ? (
              <div className="card divide-y divide-border overflow-hidden">
                {students.map((student: any, idx: number) => (
                  <div
                    key={student.id}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-surface-elevated transition-colors"
                  >
                    <span className="flex-shrink-0 text-xs text-ink-muted w-6 text-right font-mono">
                      {idx + 1}
                    </span>
                    <div className="w-9 h-9 rounded-full bg-indigo-500/15 flex items-center justify-center text-indigo-400 font-semibold text-sm flex-shrink-0">
                      {student.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{student.full_name}</p>
                      <p className="text-xs text-ink-muted truncate">{student.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card p-16 text-center">
                <Users className="h-14 w-14 mx-auto mb-4 text-ink-faint" />
                <p className="font-semibold text-ink mb-1">No students enrolled</p>
                <p className="text-sm text-ink-muted">Students will appear here once they are enrolled.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* QUIZZES TAB */}
      {tab === 'quizzes' && (
        <section className="space-y-4 animate-fade-up">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-muted">
              {quizzes?.length
                ? `${quizzes.length} quiz${quizzes.length !== 1 ? 'zes' : ''} available`
                : 'No quizzes yet'}
            </p>
            {canManage && <CreateQuizButton courseId={courseId!} />}
          </div>

          {quizzes && quizzes.length > 0 ? (
            <div className="space-y-3">
              {quizzes.map((quiz) => {
                const attemptsUsed = quiz.attempts_used ?? 0
                const isCompleted = !canManage && attemptsUsed >= quiz.max_attempts
                return (
                <div key={quiz.id} className="card px-6 py-5 hover:shadow-card-hover transition-shadow">
                  <div className="flex items-center gap-5">
                    <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${isCompleted ? 'bg-emerald-500/15' : 'bg-indigo-500/15'}`}>
                      {isCompleted
                        ? <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        : <ClipboardList className="h-5 w-5 text-indigo-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink leading-snug">{quiz.title}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-ink-muted">
                        <span>{quiz.question_count} question{quiz.question_count !== 1 ? 's' : ''}</span>
                        <span className="text-ink-faint">·</span>
                        <span>{quiz.total_points} pts</span>
                        {quiz.time_limit_min && (
                          <>
                            <span className="text-ink-faint">·</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {quiz.time_limit_min} min
                            </span>
                          </>
                        )}
                        {quiz.due_at && (
                          <>
                            <span className="text-ink-faint">·</span>
                            <span className="text-rose-400 font-medium flex items-center gap-1">
                              <CalendarDays className="h-3.5 w-3.5" />
                              Due {formatDate(quiz.due_at)}
                            </span>
                          </>
                        )}
                        {!canManage && !isCompleted && attemptsUsed > 0 && (
                          <>
                            <span className="text-ink-faint">·</span>
                            <span>Attempt {attemptsUsed + 1} of {quiz.max_attempts}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      {canManage ? (
                        <>
                          <Link to={ROUTES.QUIZ_BUILDER(courseId!, quiz.id)} className="btn-secondary btn-sm">
                            <Pencil className="h-3.5 w-3.5" /> Build
                          </Link>
                          <Link to={ROUTES.QUIZ_SUBMISSIONS(courseId!, quiz.id)} className="btn-secondary btn-sm">
                            <ClipboardCheck className="h-3.5 w-3.5" /> Submissions
                          </Link>
                        </>
                      ) : !quiz.is_published ? (
                        <span className="text-xs text-ink-muted italic">Not available yet</span>
                      ) : isCompleted ? (
                        <Link
                          to={ROUTES.QUIZ_TAKE(quiz.id)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-semibold px-3 py-1.5 transition-colors"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> View result
                        </Link>
                      ) : (
                        <Link to={ROUTES.QUIZ_TAKE(quiz.id)} className="btn-primary btn-sm">
                          {attemptsUsed > 0 ? 'Continue' : 'Start Quiz'} <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          ) : (
            <div className="card p-16 text-center">
              <ClipboardList className="h-14 w-14 mx-auto mb-4 text-ink-faint" />
              <p className="font-semibold text-ink mb-1">No quizzes yet</p>
              <p className="text-sm text-ink-muted">
                {canManage
                  ? 'Create your first quiz using the button above.'
                  : "Your teacher hasn't added any quizzes yet."}
              </p>
            </div>
          )}
        </section>
      )}

      {/* ASSIGNMENTS TAB */}
      {tab === 'assignments' && (
        <section className="space-y-4 animate-fade-up">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-muted">
              {assignments?.length
                ? `${assignments.length} assignment${assignments.length !== 1 ? 's' : ''}`
                : 'No assignments yet'}
            </p>
            {canManage && <CreateAssignmentButton courseId={courseId!} />}
          </div>

          {assignments && assignments.length > 0 ? (
            <div className="space-y-3">
              {assignments.map((assignment) => {
                const isCompleted = assignment.has_submission
                return (
                <div key={assignment.id} className="card px-6 py-5 hover:shadow-card-hover transition-shadow">
                  <div className="flex items-center gap-5">
                    <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${isCompleted ? 'bg-emerald-500/15' : 'bg-indigo-500/15'}`}>
                      {isCompleted
                        ? <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        : <FileText className="h-5 w-5 text-indigo-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink leading-snug">{assignment.title}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-ink-muted">
                        <span>Max score: {assignment.max_score}</span>
                        {assignment.due_at && (
                          <>
                            <span className="text-ink-faint">·</span>
                            <span className="text-rose-400 font-medium flex items-center gap-1">
                              <CalendarDays className="h-3.5 w-3.5" />
                              Due {formatDate(assignment.due_at)}
                            </span>
                          </>
                        )}
                        {assignment.allows_file_upload && (
                          <>
                            <span className="text-ink-faint">·</span>
                            <span className="flex items-center gap-1">
                              <Upload className="h-3.5 w-3.5" />
                              File upload
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {canManage ? (
                        <Link to={ROUTES.ASSIGNMENT_SUBMISSIONS(assignment.id)} className="btn-secondary btn-sm">
                          <Pencil className="h-3.5 w-3.5" /> Submissions
                        </Link>
                      ) : !assignment.is_published ? (
                        <span className="text-xs text-ink-muted italic">Not available yet</span>
                      ) : isCompleted ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold px-3 py-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Submitted
                        </span>
                      ) : (
                        <Link to={ROUTES.ASSIGNMENT_SUBMIT(assignment.id)} className="btn-primary btn-sm">
                          Submit <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          ) : (
            <div className="card p-16 text-center">
              <FileText className="h-14 w-14 mx-auto mb-4 text-ink-faint" />
              <p className="font-semibold text-ink mb-1">No assignments yet</p>
              <p className="text-sm text-ink-muted">
                {canManage
                  ? 'Create your first assignment using the button above.'
                  : "Your teacher hasn't added any assignments yet."}
              </p>
            </div>
          )}
        </section>
      )}

      {/* GRADES TAB */}
      {tab === 'grades' && (
        <section className="animate-fade-up">
          {canManage
            ? <TeacherGradesView courseId={courseId!} />
            : <StudentGradesView courseId={courseId!} />
          }
        </section>
      )}
    </div>
  )
}

const GRADE_COLORS: Record<number, string> = {
  5: 'text-emerald-400 bg-emerald-500/15',
  4: 'text-blue-400 bg-blue-500/15',
  3: 'text-amber-400 bg-amber-500/15',
  2: 'text-orange-400 bg-orange-500/15',
  1: 'text-rose-400 bg-rose-500/15',
}

function gradeStyle(grade: number) {
  return GRADE_COLORS[grade] ?? 'text-ink-muted bg-surface-overlay'
}

function TeacherGradesView({ courseId }: { courseId: string }) {
  const { data: gradebook, isLoading } = useGradebook(courseId)

  if (isLoading) return <PageLoader />

  if (!gradebook?.rows?.length) {
    return (
      <div className="card p-16 text-center">
        <GraduationCap className="h-14 w-14 mx-auto mb-4 text-ink-faint" />
        <p className="font-semibold text-ink mb-2">No grades yet</p>
        <p className="text-sm text-ink-muted mb-6">Start grading students from the full gradebook.</p>
        <Link to={ROUTES.GRADEBOOK(courseId)} className="btn-primary">
          <Award className="h-4 w-4" /> Open Gradebook
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-muted">{gradebook.rows.length} student{gradebook.rows.length !== 1 ? 's' : ''}</p>
        <Link to={ROUTES.GRADEBOOK(courseId)} className="btn-secondary btn-sm">
          <Pencil className="h-3.5 w-3.5" /> Edit Grades
        </Link>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th className="text-left">Student</th>
                <th className="text-center">Entries</th>
                <th className="text-center">Average</th>
                <th className="text-center">Final</th>
              </tr>
            </thead>
            <tbody>
              {gradebook.rows.map((row) => (
                <tr key={row.student_id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/15 flex items-center justify-center text-indigo-400 font-semibold text-xs flex-shrink-0">
                        {row.student_name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{row.student_name}</p>
                        <p className="text-xs text-ink-muted truncate">{row.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-center text-sm text-ink-secondary">{row.grades.length}</td>
                  <td className="text-center text-sm text-ink-secondary">
                    {row.weighted_average ? Number(row.weighted_average).toFixed(1) : '—'}
                  </td>
                  <td className="text-center">
                    {row.final_grade ? (
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm ${gradeStyle(row.final_grade)}`}>
                        {row.final_grade}
                      </span>
                    ) : (
                      <span className="text-sm text-ink-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StudentGradesView({ courseId }: { courseId: string }) {
  const { data: allGrades, isLoading } = useMyGrades()
  const courseGrades = allGrades?.find((g) => g.course_id === courseId)

  if (isLoading) return <PageLoader />

  if (!courseGrades || !courseGrades.entries.length) {
    return (
      <div className="card p-16 text-center">
        <GraduationCap className="h-14 w-14 mx-auto mb-4 text-ink-faint" />
        <p className="font-semibold text-ink mb-1">No grades yet</p>
        <p className="text-sm text-ink-muted">Your grades will appear here once your teacher posts them.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="card px-6 py-5 flex items-center gap-6">
        <div className="flex-1">
          <p className="text-sm text-ink-muted mb-1">Weighted Average</p>
          <p className="text-2xl font-bold text-ink font-display">
            {courseGrades.weighted_average ? Number(courseGrades.weighted_average).toFixed(2) : '—'}
          </p>
        </div>
        {courseGrades.final_grade && (
          <div className="text-center">
            <p className="text-sm text-ink-muted mb-1">Final Grade</p>
            <span className={`inline-flex items-center justify-center w-12 h-12 rounded-xl font-bold text-xl ${gradeStyle(courseGrades.final_grade)}`}>
              {courseGrades.final_grade}
            </span>
          </div>
        )}
      </div>

      {/* Grade entries list */}
      <div className="card divide-y divide-border overflow-hidden">
        {courseGrades.entries.map((entry) => {
          const earned = entry.points_earned != null ? Number(entry.points_earned) : null
          const possible = entry.points_possible != null ? Number(entry.points_possible) : null
          const hasPoints = earned !== null && possible !== null && possible > 0
          return (
            <div key={entry.id} className="flex items-center gap-4 px-6 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink">
                  {entry.label || entry.category.charAt(0).toUpperCase() + entry.category.slice(1)}
                </p>
                <p className="text-xs text-ink-muted mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="capitalize">{entry.category}</span>
                  <span className="text-ink-faint">·</span>
                  <span>Weight: {Math.round(Number(entry.weight) * 100)}%</span>
                  {entry.posted_at && (
                    <>
                      <span className="text-ink-faint">·</span>
                      <span>{formatDate(entry.posted_at)}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                {hasPoints && (
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink tabular-nums">
                      {earned} <span className="text-ink-muted">/ {possible}</span>
                    </p>
                    <p className="text-[10px] text-ink-muted uppercase tracking-wider mt-0.5">points</p>
                  </div>
                )}
                <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl font-bold text-base ${gradeStyle(entry.grade)}`}>
                  {entry.grade}
                </span>
              </div>
            </div>
          )
        })}
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
          <p className="text-xs text-ink-muted">
            Quiz weight is auto-computed from the course category weights. Configure category weights in Course Settings.
          </p>
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

function CreateAssignmentButton({ courseId }: { courseId: string }) {
  const [show, setShow] = useState(false)
  const { mutate: createAssignment, isPending } = useCreateAssignment(courseId)
  const { register, handleSubmit, reset } = useForm<{ title: string; description: string; due_at: string; max_score: string }>({
    defaultValues: { max_score: '100' },
  })

  return (
    <>
      <button onClick={() => setShow(true)} className="btn-primary btn-sm">
        <Plus className="h-4 w-4" /> New Assignment
      </button>
      <Modal isOpen={show} onClose={() => setShow(false)} title="Create Assignment">
        <form
          onSubmit={handleSubmit((d) =>
            createAssignment({
              title: d.title,
              description: d.description || undefined,
              due_at: d.due_at || undefined,
              max_score: Number(d.max_score),
            } as any, {
              onSuccess: () => {
                setShow(false)
                reset()
              },
            })
          )}
          className="space-y-4"
        >
          <div>
            <label className="label">Title *</label>
            <input {...register('title', { required: true })} className="input" placeholder="e.g. Chapter 1 Homework" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea {...register('description')} rows={3} className="input resize-none" placeholder="Instructions for students..." />
          </div>
          <div>
            <label className="label">Due Date</label>
            <input {...register('due_at')} type="datetime-local" className="input" />
          </div>
          <div>
            <label className="label">Max Score</label>
            <input {...register('max_score')} type="number" min="1" className="input" />
          </div>
          <p className="text-xs text-ink-muted">
            Assignment weight is auto-computed from the course category weights.
          </p>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShow(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1">
              {isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
