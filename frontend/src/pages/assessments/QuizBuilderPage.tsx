import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, Settings } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Modal } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/Spinner'
import { ROUTES } from '@/config/routes'
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz', quizId] }),
  })

  const { mutate: addQuestion, isPending: addingQuestion } = useMutation({
    mutationFn: (data: any) => api.post(`/assessments/quizzes/${quizId}/questions`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz', quizId] }),
  })

  const [showSettings, setShowSettings] = useState(false)
  const [showAddQuestion, setShowAddQuestion] = useState(false)
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
      max_attempts: quiz?.max_attempts ?? 1,
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

  const onAddQuestion = (data: { text: string; points: string; explanation: string }) => {
    const payload: any = {
      text: data.text,
      question_type: questionType,
      points: Number(data.points) || 10,
      explanation: data.explanation || null,
      options: [],
    }

    if (questionType === 'mcq' || questionType === 'true_false') {
      payload.options = options.filter((o) => o.text.trim()).map((o, i) => ({ text: o.text, is_correct: o.is_correct, position: i }))
    }

    addQuestion(payload, {
      onSuccess: () => {
        setShowAddQuestion(false)
        questionForm.reset({ points: '10' })
        setOptions([{ text: '', is_correct: false }, { text: '', is_correct: false }])
        setQuestionType('mcq')
      },
    })
  }

  const initTrueFalse = () => {
    setOptions([{ text: 'True', is_correct: false }, { text: 'False', is_correct: false }])
  }

  if (isLoading) return <PageLoader />
  if (!quiz) return <div className="text-center text-slate-500 py-16">Quiz not found</div>

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={ROUTES.COURSE_DETAIL(courseId!)} className="text-slate-500 hover:text-slate-400">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{quiz.title}</h1>
          <p className="text-sm text-slate-500">
            {quiz.question_count} questions · {quiz.total_points} pts
            {quiz.is_published ? ' · Published' : ' · Draft'}
          </p>
        </div>
        <button onClick={() => setShowSettings(true)} className="btn-secondary text-sm">
          <Settings className="h-4 w-4" /> Settings
        </button>
      </div>

      {/* Questions */}
      <div className="space-y-3">
        {quiz.questions?.map((q, idx) => (
          <div key={q.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-xs text-slate-500 mb-1">Q{idx + 1} · {QUESTION_TYPES.find((t) => t.value === q.question_type)?.label} · {q.points} pts</p>
                <p className="font-medium text-white">{q.text}</p>
                {q.options.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {q.options.map((opt) => (
                      <li key={opt.id} className={`flex items-center gap-2 text-sm rounded px-3 py-1.5 ${opt.is_correct ? 'bg-green-50 text-green-700' : 'bg-slate-800/50 text-slate-400'}`}>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.is_correct ? 'bg-green-500' : 'bg-gray-300'}`} />
                        {opt.text}
                      </li>
                    ))}
                  </ul>
                )}
                {q.explanation && <p className="mt-2 text-xs text-slate-500 italic">Explanation: {q.explanation}</p>}
              </div>
            </div>
          </div>
        ))}

        {!quiz.questions?.length && (
          <div className="card p-10 text-center text-slate-500">
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Time Limit (min)</label>
              <input {...settingsForm.register('time_limit_min')} type="number" min="1" className="input" placeholder="Unlimited" />
            </div>
            <div>
              <label className="label">Max Attempts</label>
              <input {...settingsForm.register('max_attempts')} type="number" min="1" className="input" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="qz_published" {...settingsForm.register('is_published')} className="rounded" />
            <label htmlFor="qz_published" className="text-sm text-slate-300">Published (visible to students)</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowSettings(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={savingQuiz} className="btn-primary flex-1">
              {savingQuiz ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Question Modal */}
      <Modal isOpen={showAddQuestion} onClose={() => setShowAddQuestion(false)} title="Add Question">
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
                    <button type="button" onClick={() => toggleCorrect(i)} className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${opt.is_correct ? 'bg-green-500 border-green-500' : 'border-slate-600'}`} />
                    {questionType === 'true_false' ? (
                      <span className="flex-1 input bg-slate-800/50">{opt.text}</span>
                    ) : (
                      <input value={opt.text} onChange={(e) => setOptionText(i, e.target.value)} className="input flex-1" placeholder={`Option ${i + 1}`} />
                    )}
                    {questionType === 'mcq' && options.length > 2 && (
                      <button type="button" onClick={() => removeOption(i)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                {questionType === 'mcq' && options.length < 6 && (
                  <button type="button" onClick={addOption} className="text-sm text-primary-600 hover:underline">+ Add option</button>
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
            <button type="button" onClick={() => setShowAddQuestion(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={addingQuestion} className="btn-primary flex-1">
              {addingQuestion ? 'Adding...' : 'Add Question'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
