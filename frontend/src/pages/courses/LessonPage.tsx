import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, PlayCircle, FileText, File, Image, FileArchive, FileSpreadsheet, Paperclip, Download, Eye, EyeOff, Maximize2 } from 'lucide-react'
import api from '@/config/axios'
import { PageLoader } from '@/components/ui/Spinner'
import { ROUTES } from '@/config/routes'
import { getYouTubeEmbedUrl } from '@/utils/formatters'

interface Attachment {
  id: string
  filename: string
  mime_type: string
  size_bytes: number
  url: string
}

interface Lesson {
  id: string
  title: string
  content_type: 'text' | 'video' | 'embed' | 'file'
  body: string | null
  video_url: string | null
  duration_min: number | null
  attachments: Attachment[]
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return <Image className="h-4 w-4" />
  if (mime.includes('pdf')) return <FileText className="h-4 w-4 text-red-400" />
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return <FileSpreadsheet className="h-4 w-4 text-green-400" />
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('tar')) return <FileArchive className="h-4 w-4 text-yellow-400" />
  return <File className="h-4 w-4 text-ink-muted" />
}

function isPreviewable(att: Attachment): boolean {
  return att.mime_type.startsWith('image/') || att.mime_type.includes('pdf')
}

export function LessonPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>()!
  const navigate = useNavigate()
  const [previewId, setPreviewId] = useState<string | null>(null)

  const { data: lesson, isLoading } = useQuery<Lesson>({
    queryKey: ['lesson', lessonId],
    queryFn: () => api.get(`/courses/${courseId}/lessons/${lessonId}`).then((r) => r.data),
    enabled: !!lessonId && !!courseId,
  })

  if (isLoading) return <PageLoader />
  if (!lesson) return <div className="text-center text-ink-muted py-16">Lesson not found</div>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back link */}
      <button
        onClick={() => navigate(ROUTES.COURSE_DETAIL(courseId!))}
        className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink-secondary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to course
      </button>

      {/* Header */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-2">
          {lesson.content_type === 'video' && <PlayCircle className="h-5 w-5 text-blue-400" />}
          {lesson.content_type === 'text' && <FileText className="h-5 w-5 text-ink-muted" />}
          {lesson.duration_min && (
            <span className="text-sm text-ink-muted">{lesson.duration_min} min</span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-ink font-display">{lesson.title}</h1>
      </div>

      {/* Video */}
      {lesson.content_type === 'video' && lesson.video_url && (
        <div className="card overflow-hidden">
          <div className="aspect-video">
            <iframe
              src={getYouTubeEmbedUrl(lesson.video_url)}
              className="w-full h-full"
              allowFullScreen
              title={lesson.title}
            />
          </div>
        </div>
      )}

      {/* Embed */}
      {lesson.content_type === 'embed' && lesson.video_url && (
        <div className="card overflow-hidden">
          <div className="aspect-video">
            <iframe
              src={getYouTubeEmbedUrl(lesson.video_url)}
              className="w-full h-full"
              allowFullScreen
              title={lesson.title}
            />
          </div>
        </div>
      )}

      {/* Text body */}
      {lesson.body && (
        <div className="card p-6 prose prose-sm prose-invert max-w-none text-ink-secondary leading-relaxed">
          <div dangerouslySetInnerHTML={{ __html: lesson.body }} />
        </div>
      )}

      {/* Attachments */}
      {lesson.attachments && lesson.attachments.length > 0 && (
        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
            <Paperclip className="h-4 w-4" /> Attachments
          </h3>
          {lesson.attachments.map((att) => (
            <div key={att.id}>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-elevated/40 border border-border/60">
                {fileIcon(att.mime_type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink truncate">{att.filename}</p>
                  <p className="text-xs text-ink-muted">{formatBytes(att.size_bytes)}</p>
                </div>
                <div className="flex items-center gap-1">
                  {isPreviewable(att) && (
                    <button
                      onClick={() => setPreviewId(previewId === att.id ? null : att.id)}
                      className="btn-ghost p-1.5 rounded-md"
                      title={previewId === att.id ? 'Hide preview' : 'Preview'}
                    >
                      {previewId === att.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost p-1.5 rounded-md"
                    title="Open in new tab"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </a>
                  <a
                    href={att.url}
                    download
                    className="btn-ghost p-1.5 rounded-md text-primary-400"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </div>
              </div>
              {/* Inline preview for PDFs and images */}
              {previewId === att.id && (
                <div className="mt-2 rounded-lg overflow-hidden border border-border/60 bg-black/5">
                  {att.mime_type.includes('pdf') ? (
                    <iframe
                      src={att.url}
                      className="w-full h-[500px]"
                      title={att.filename}
                    />
                  ) : att.mime_type.startsWith('image/') ? (
                    <div className="flex justify-center p-4">
                      <img
                        src={att.url}
                        alt={att.filename}
                        className="max-w-full max-h-[500px] object-contain rounded"
                      />
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
