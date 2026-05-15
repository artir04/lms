import { useParams, Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { ArrowLeft, Send, AlertCircle, FileText, Clock } from 'lucide-react'
import { useAssignment, useSubmitAssignment } from '@/api/assignments'
import { PageLoader } from '@/components/ui/Spinner'
import { FileUpload } from '@/components/assignment/FileUpload'
import { ROUTES } from '@/config/routes'
import { formatDate } from '@/utils/formatters'
import api from '@/config/axios'

export function AssignmentSubmitPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const { data: assignment, isLoading } = useAssignment(assignmentId ?? '')
  const { mutate: submit, isPending } = useSubmitAssignment(assignmentId ?? '')
  const navigate = useNavigate()

  const [textResponse, setTextResponse] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  if (isLoading) return <PageLoader />
  if (!assignment) return <div className="text-center text-ink-muted py-16">Assignment not found</div>

  const handleSubmit = async () => {
    setError(null)
    if (!textResponse.trim() && uploadedFiles.length === 0) {
      setError('Please provide a text response or upload a file')
      return
    }

    let file_urls: { files: { name: string; size: number; url: string }[] } | undefined
    if (uploadedFiles.length > 0) {
      setUploading(true)
      try {
        const uploaded = await Promise.all(
          uploadedFiles.map(async (f) => {
            const fd = new FormData()
            fd.append('file', f)
            const res = await api.post<{ name: string; size: number; url: string }>(
              `/assignments/${assignmentId}/submissions/upload`,
              fd,
              { headers: { 'Content-Type': 'multipart/form-data' } },
            )
            return res.data
          }),
        )
        file_urls = { files: uploaded }
      } catch (err: any) {
        setUploading(false)
        const detail = err?.response?.data?.detail
        setError(typeof detail === 'string' ? detail : 'Failed to upload attachment')
        return
      }
      setUploading(false)
    }

    submit(
      { text_response: textResponse.trim() || undefined, file_urls },
      {
        onSuccess: () => navigate(ROUTES.ASSIGNMENT_DETAIL(assignmentId!)),
        onError: (err: any) => {
          const detail = err?.response?.data?.detail
          if (typeof detail === 'string') setError(detail)
          else if (Array.isArray(detail)) setError(detail.map((d: any) => d?.msg ?? 'Invalid input').join(', '))
          else setError('Failed to submit')
        },
      },
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to={ROUTES.ASSIGNMENT_DETAIL(assignmentId!)}
          className="text-ink-muted hover:text-ink-secondary transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-ink font-display">Submit Assignment</h1>
          <p className="text-sm text-ink-muted">{assignment.title}</p>
        </div>
      </div>

      {/* Assignment details */}
      <div className="card p-5 space-y-2">
        <h2 className="font-semibold text-ink">{assignment.title}</h2>
        {assignment.description && (
          <p className="text-sm text-ink-secondary whitespace-pre-wrap">{assignment.description}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-ink-muted">
          {assignment.due_at && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Due {formatDate(assignment.due_at)}
            </span>
          )}
          <span>Max score: {assignment.max_score}</span>
          {assignment.allows_file_upload && (
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Files allowed
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm text-rose-400">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Text response */}
      <div className="card p-5 space-y-3">
        <h3 className="text-sm font-medium text-ink">Your Response</h3>
        <textarea
          value={textResponse}
          onChange={(e) => setTextResponse(e.target.value)}
          rows={8}
          className="input resize-none"
          placeholder="Type your answer here..."
        />
      </div>

      {/* File upload */}
      {assignment.allows_file_upload && (
        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-medium text-ink">Attachments</h3>
          <FileUpload
            onFilesChange={setUploadedFiles}
            allowedTypes={assignment.allowed_file_types ?? undefined}
          />
        </div>
      )}

      <button onClick={handleSubmit} disabled={isPending || uploading} className="btn-primary w-full">
        <Send className="h-4 w-4" />
        {uploading ? 'Uploading...' : isPending ? 'Submitting...' : 'Submit Assignment'}
      </button>
    </div>
  )
}
