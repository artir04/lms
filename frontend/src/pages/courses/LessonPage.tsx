import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, PlayCircle, FileText, Paperclip, Download } from 'lucide-react'
import api from '@/config/axios'
import { PageLoader } from '@/components/ui/Spinner'
import { ROUTES } from '@/config/routes'

interface Lesson {
  id: string
  title: string
  content_type: 'text' | 'video' | 'embed' | 'file'
  body: string | null
  video_url: string | null
  embed_url: string | null
  duration_min: number | null
  attachments: { id: string; filename: string; storage_key: string; url?: string }[]
}

export function LessonPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>()!
  const navigate = useNavigate()

  const { data: lesson, isLoading } = useQuery<Lesson>({
    queryKey: ['lesson', lessonId],
    queryFn: () => api.get(`/courses/${courseId}/lessons/${lessonId}`).then((r) => r.data),
    enabled: !!lessonId && !!courseId,
  })

  if (isLoading) return <PageLoader />
  if (!lesson) return <div className="text-center text-slate-500 py-16">Lesson not found</div>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back link */}
      <button
        onClick={() => navigate(ROUTES.COURSE_DETAIL(courseId!))}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to course
      </button>

      {/* Header */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-2">
          {lesson.content_type === 'video' && <PlayCircle className="h-5 w-5 text-blue-500" />}
          {lesson.content_type === 'text' && <FileText className="h-5 w-5 text-slate-500" />}
          {lesson.duration_min && (
            <span className="text-sm text-slate-500">{lesson.duration_min} min</span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-white">{lesson.title}</h1>
      </div>

      {/* Video */}
      {lesson.content_type === 'video' && lesson.video_url && (
        <div className="card overflow-hidden">
          <div className="aspect-video">
            <iframe
              src={lesson.video_url}
              className="w-full h-full"
              allowFullScreen
              title={lesson.title}
            />
          </div>
        </div>
      )}

      {/* Embed */}
      {lesson.content_type === 'embed' && lesson.embed_url && (
        <div className="card overflow-hidden">
          <div className="aspect-video">
            <iframe
              src={lesson.embed_url}
              className="w-full h-full"
              allowFullScreen
              title={lesson.title}
            />
          </div>
        </div>
      )}

      {/* Text body */}
      {lesson.body && (
        <div className="card p-6 prose prose-sm max-w-none text-slate-300 leading-relaxed">
          <div dangerouslySetInnerHTML={{ __html: lesson.body }} />
        </div>
      )}

      {/* Attachments */}
      {lesson.attachments && lesson.attachments.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Paperclip className="h-4 w-4" /> Attachments
          </h3>
          <ul className="space-y-2">
            {lesson.attachments.map((att) => (
              <li key={att.id}>
                <a
                  href={att.url || `/media/${att.storage_key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary-600 hover:underline"
                >
                  <Download className="h-4 w-4" />
                  {att.filename}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
