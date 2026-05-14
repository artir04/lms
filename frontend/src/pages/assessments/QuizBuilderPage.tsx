import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  Settings,
  ClipboardCheck,
  ClipboardList,
  Target,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useForm } from 'react-hook-form'
import { Modal } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/Spinner'
import { ROUTES } from '@/config/routes'
import { toast } from '@/store/toastStore'
import api from '@/config/axios'
import type { Quiz, Question } from '@/types/assessment'

const QUESTION_TYPES = [
  { value: 'mcq', label: 'Multiple Choice' },
  { value: 'true_false', label: 'True / False' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'essay', label: 'Essay' },
]

export function QuizBuilderPage() {
  const { courseId, quizId } = useParams<{ courseId: string; quizId: string }>()!
  const qc = useQueryClient()

  const { data: quiz, isLoading } = useQuery<Quiz & { questions: Question[] }>({
    queryKey: ['quiz', quizId],
    queryFn: () => api.get(`/assessments/quizzes/${quizId}`).then((r) => r.data),
    enabled: !!quizId,
  })

  const { mutate: updateQuiz, isPending: savingQuiz } = useMutation({
    mutationFn: (data: Partial<Quiz>) => api.patch(`/assessments/quizzes/${quizId}`, data).then((r) => r.data),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['quiz', quizId] })
      qc.invalidateQueries({ queryKey: ['quizzes'] })
      if (data && typeof data.is_published === 'boolean' && quiz && data.is_published !== quiz.is_published) {
        toast.success(data.is_published ? 'Quiz published — students can now see it' : 'Quiz unpublished')
      }
    },
    onError: () => toast.error('Failed to save quiz'),
  })

  const { mutate: addQuestion, isPending: addingQuestion } = useMutation({
    mutationFn: (data: any) => api.post(`/assessments/quizzes/${quizId}/questions`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quiz', quizId] })
      qc.invalidateQueries({ queryKey: ['quizzes'] })
      toast.success('Question added')
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to add question'),
  })

  const { mutate: updateQuestion, isPending: updatingQuestion } = useMutation({
    mutationFn: ({ questionId, data }: { questionId: string; data: any }) =>
      api.patch(`/assessments/questions/${questionId}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quiz', quizId] })
      qc.invalidateQueries({ queryKey: ['quizzes'] })
      toast.success('Question updated')
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to update question'),
  })

  const { mutate: deleteQuestion, isPending: deletingQuestionPending } = useMutation({
    mutationFn: (questionId: string) => api.delete(`/assessments/questions/${questionId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quiz', quizId] })
      qc.invalidateQueries({ queryKey: ['quizzes'] })
      toast.success('Question deleted')
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to delete question'),
  })

  const [showSettings, setShowSettings] = useState(false)
  const [showAddQuestion, setShowAddQuestion] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [deletingQuestion, setDeletingQuestion] = useState<Question | null>(null)
  const [questionType, setQuestionType] = useState<string>('mcq')
  const [options, setOptions] = useState([
    { text: '', is_correct: false },
    { text: '', is_correct: false },
  ])

  const settingsForm = useForm({
    values: {
      title: quiz?.title || '',
      instructions: quiz?.instructions || '',
      time_limit_min: quiz?.time_limit_min ?? '',
      is_published: quiz?.is_published ?? false,
    },
  })

  const questionForm = useForm<{ text: string; points: string; explanation: string }>({
    defaultValues: { points: '10' },
  })

  const addOption = () => setOptions((prev) => [...prev, { text: '', is_correct: false }])
  const removeOption = (i: number) => setOptions((prev) => prev.filter((_, idx) => idx !== i))
  const toggleCorrect = (i: number) => {
    if (questionType === 'mcq') {
      setOptions((prev) => prev.map((o, idx) => ({ ...o, is_correct: idx === i })))
    } else {
      setOptions((prev) => prev.map((o, idx) => idx === i ? { ...o, is_correct: !o.is_correct } : o))
    }
  }
  const setOptionText = (i: number, text: string) =>
    setOptions((prev) => prev.map((o, idx) => idx === i ? { ...o, text } : o))

  const resetQuestionForm = () => {
    setShowAddQuestion(false)
    setEditingQuestion(null)
    questionForm.reset({ points: '10' })
    setOptions([{ text: '', is_correct: false }, { text: '', is_correct: false }])
    setQuestionType('mcq')
  }

  const onAddQuestion = (data: { text: string; points: string; explanation: string }) => {
    const payload: any = {
      text: data.text,
      question_type: questionType,
      points: Number(data.points) || 10,
      explanation: data.explanation || null,
      options: [],
    }

    if (questionType === 'mcq' || questionType === 'true_false') {
      payload.options = options.filter((o) => o.text.trim()).map((o) => ({ text: o.text, is_correct: o.is_correct }))
    }

    if (editingQuestion) {
      updateQuestion({ questionId: editingQuestion.id, data: payload }, { onSuccess: resetQuestionForm })
    } else {
      addQuestion(payload, { onSuccess: resetQuestionForm })
    }
  }

  const openEditQuestion = (q: Question) => {
    setEditingQuestion(q)
    setShowAddQuestion(false)
    setQuestionType(q.question_type)
    questionForm.reset({
      text: q.text,
      points: String(q.points ?? 10),
      explanation: q.explanation ?? '',
    })
    if (q.question_type === 'mcq' || q.question_type === 'true_false') {
      setOptions(q.options.length > 0
        ? q.options.map((o) => ({ text: o.text, is_correct: !!o.is_correct }))
        : [{ text: '', is_correct: false }, { text: '', is_correct: false }])
    } else {
      setOptions([])
    }
  }

  const initTrueFalse = () => {
    setOptions([{ text: 'True', is_correct: false }, { text: 'False', is_correct: false }])
  }

  if (isLoading) return <PageLoader />
  if (!quiz) return <div className="text-center text-ink-muted py-16">Quiz not found</div>

  const isPublished = !!quiz.is_published
  const canPublish = (quiz.question_count ?? 0) > 0
  const togglePublish = () => {
    if (!canPublish && !isPublished) {
      toast.warning('Add at least one question before publishing')
      return
    }
    updateQuiz({ is_published: !isPublished } as Partial<Quiz>)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link to={ROUTES.COURSE_DETAIL(courseId!)} className="text-ink-muted hover:text-ink-secondary transition-colors mt-1.5">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-ink font-display">{quiz.title}</h1>
            <span
              className={[
                'inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-2.5 py-1',
                isPublished
                  ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30',
              ].join(' ')}
            >
              {isPublished ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {isPublished ? 'Published' : 'Draft'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-elevated/60 border border-border text-ink-secondary px-2.5 py-1">
              <ClipboardList className="h-3.5 w-3.5 text-indigo-400" />
              <span className="font-semibold text-ink">{quiz.question_count ?? 0}</span>
              question{(quiz.question_count ?? 0) === 1 ? '' : 's'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-elevated/60 border border-border text-ink-secondary px-2.5 py-1">
              <Target className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-semibold text-ink">{Number(quiz.total_points ?? 0)}</span>
              point{Number(quiz.total_points ?? 0) === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <Link
          to={ROUTES.QUIZ_SUBMISSIONS(courseId!, quizId!)}
          className="btn-secondary text-sm"
        >
          <ClipboardCheck className="h-4 w-4" /> Submissions
        </Link>
        <button onClick={() => setShowSettings(true)} className="btn-secondary text-sm">
          <Settings className="h-4 w-4" /> Settings
        </button>
        <button
          onClick={togglePublish}
          disabled={savingQuiz}
          className={[
            'inline-flex items-center gap-1.5 rounded-xl text-sm font-medium px-4 py-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed',
            isPublished
              ? 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 ring-1 ring-amber-500/30'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_0_20px_-6px_rgba(16,185,129,0.55)]',
          ].join(' ')}
        >
          {isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {savingQuiz ? '…' : isPublished ? 'Unpublish' : 'Publish'}
        </button>
      </div>

      {/* Draft banner */}
      {!isPublished && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] px-5 py-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1 text-sm text-ink-secondary">
            <p className="font-semibold text-ink">This quiz is a draft</p>
            <p className="mt-0.5">
              Students cannot see it yet. {canPublish ? 'Click ' : 'Add at least one question, then click '}
              <span className="font-semibold text-emerald-300">Publish</span>
              {canPublish ? ' when you\'re ready.' : ' above.'} Every question is saved automatically when you add it.
            </p>
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="space-y-3">
        {quiz.questions?.map((q, idx) => (
          <div key={q.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-ink-muted mb-1">Q{idx + 1} · {QUESTION_TYPES.find((t) => t.value === q.question_type)?.label} · {Number(q.points)} pts</p>
                <p className="font-medium text-ink">{q.text}</p>
                {q.options.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {q.options.map((opt) => (
                      <li key={opt.id} className={`flex items-center gap-2 text-sm rounded-lg px-3 py-1.5 ${opt.is_correct ? 'bg-emerald-500/15 text-emerald-400' : 'bg-surface-elevated/50 text-ink-secondary'}`}>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.is_correct ? 'bg-emerald-500' : 'bg-ink-faint'}`} />
                        {opt.text}
                      </li>
                    ))}
                  </ul>
                )}
                {q.explanation && <p className="mt-2 text-xs text-ink-muted italic">Explanation: {q.explanation}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openEditQuestion(q)}
                  className="btn-ghost p-1.5 rounded-md text-ink-muted hover:text-primary-400"
                  title="Edit question"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeletingQuestion(q)}
                  className="btn-ghost p-1.5 rounded-md text-rose-400 hover:text-rose-300"
                  title="Delete question"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {!quiz.questions?.length && (
          <div className="card p-10 text-center text-ink-muted">
            <p>No questions yet. Add your first question below.</p>
          </div>
        )}
      </div>

      <button onClick={() => { setShowAddQuestion(true); setQuestionType('mcq'); setOptions([{ text: '', is_correct: false }, { text: '', is_correct: false }]) }} className="btn-primary">
        <Plus className="h-4 w-4" /> Add Question
      </button>

      {/* Quiz Settings Modal */}
      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="Quiz Settings">
        <form onSubmit={settingsForm.handleSubmit((d) => updateQuiz({ ...d, time_limit_min: d.time_limit_min ? Number(d.time_limit_min) : null }, { onSuccess: () => setShowSettings(false) }))} className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input {...settingsForm.register('title', { required: true })} className="input" />
          </div>
          <div>
            <label className="label">Instructions</label>
            <textarea {...settingsForm.register('instructions')} rows={3} className="input resize-none" />
          </div>
          <div>
            <label className="label">Time Limit (min)</label>
            <input {...settingsForm.register('time_limit_min')} type="number" min="1" className="input" placeholder="Unlimited" />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="qz_published" {...settingsForm.register('is_published')} className="rounded" />
            <label htmlFor="qz_published" className="text-sm text-ink-secondary">Published (visible to students)</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowSettings(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={savingQuiz} className="btn-primary flex-1">
              {savingQuiz ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add / Edit Question Modal */}
      <Modal
        isOpen={showAddQuestion || !!editingQuestion}
        onClose={resetQuestionForm}
        title={editingQuestion ? 'Edit Question' : 'Add Question'}
      >
        <form onSubmit={questionForm.handleSubmit(onAddQuestion)} className="space-y-4">
          <div>
            <label className="label">Question Type</label>
            <select
              value={questionType}
              onChange={(e) => {
                setQuestionType(e.target.value)
                if (e.target.value === 'true_false') initTrueFalse()
                else if (e.target.value === 'mcq') setOptions([{ text: '', is_correct: false }, { text: '', is_correct: false }])
                else setOptions([])
              }}
              className="input"
            >
              {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Question Text *</label>
            <textarea {...questionForm.register('text', { required: true })} rows={3} className="input resize-none" placeholder="Enter the question..." />
          </div>

          {/* MCQ / True-False options */}
          {(questionType === 'mcq' || questionType === 'true_false') && (
            <div>
              <label className="label">Answer Options (click radio to mark correct)</label>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button type="button" onClick={() => toggleCorrect(i)} className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${opt.is_correct ? 'bg-emerald-500 border-emerald-500' : 'border-border-strong'}`} />
                    {questionType === 'true_false' ? (
                      <span className="flex-1 input bg-surface-elevated/50">{opt.text}</span>
                    ) : (
                      <input value={opt.text} onChange={(e) => setOptionText(i, e.target.value)} className="input flex-1" placeholder={`Option ${i + 1}`} />
                    )}
                    {questionType === 'mcq' && options.length > 2 && (
                      <button type="button" onClick={() => removeOption(i)} className="text-red-400 hover:text-red-300">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                {questionType === 'mcq' && options.length < 6 && (
                  <button type="button" onClick={addOption} className="text-sm text-primary-400 hover:underline">+ Add option</button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Points</label>
              <input {...questionForm.register('points')} type="number" min="1" className="input" />
            </div>
            <div>
              <label className="label">Explanation (optional)</label>
              <input {...questionForm.register('explanation')} className="input" placeholder="Shown after submit" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={resetQuestionForm} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={addingQuestion || updatingQuestion} className="btn-primary flex-1">
              {editingQuestion
                ? (updatingQuestion ? 'Saving…' : 'Save changes')
                : (addingQuestion ? 'Adding…' : 'Add Question')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingQuestion}
        onClose={() => setDeletingQuestion(null)}
        onConfirm={() => {
          if (!deletingQuestion) return
          deleteQuestion(deletingQuestion.id, { onSuccess: () => setDeletingQuestion(null) })
        }}
        title="Delete this question?"
        description={
          deletingQuestion
            ? `"${deletingQuestion.text}" and any submitted answers to it will be removed.`
            : ''
        }
        confirmLabel="Delete question"
        loading={deletingQuestionPending}
      />
    </div>
  )
}
