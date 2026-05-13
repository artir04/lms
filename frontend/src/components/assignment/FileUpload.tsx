import { useRef, useState } from 'react'
import { Upload, X, File } from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatFileSize } from '@/utils/formatters'

interface SelectedFile {
  file: File
  id: string
}

interface FileUploadProps {
  onFilesChange: (files: File[]) => void
  allowedTypes?: string
  maxFiles?: number
  maxSizeMB?: number
}

export function FileUpload({ onFilesChange, allowedTypes, maxFiles = 5, maxSizeMB = 10 }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([])
  const [error, setError] = useState<string | null>(null)

  const accept = allowedTypes
    ? allowedTypes.split(',').map((t) => `.${t.trim()}`).join(',')
    : undefined

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const files = Array.from(e.target.files ?? [])
    const maxBytes = maxSizeMB * 1024 * 1024

    for (const file of files) {
      if (file.size > maxBytes) {
        setError(`File "${file.name}" exceeds ${maxSizeMB}MB limit`)
        return
      }
    }

    const updated = [...selectedFiles, ...files.map((f) => ({ file: f, id: crypto.randomUUID() }))].slice(0, maxFiles)
    setSelectedFiles(updated)
    onFilesChange(updated.map((f) => f.file))
  }

  const removeFile = (id: string) => {
    const updated = selectedFiles.filter((f) => f.id !== id)
    setSelectedFiles(updated)
    onFilesChange(updated.map((f) => f.file))
  }

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed border-slate-600 rounded-lg p-6 text-center cursor-pointer',
          'hover:border-indigo-500/60 hover:bg-slate-800/40 transition-colors',
        )}
      >
        <Upload className="h-6 w-6 mx-auto mb-2 text-slate-500" />
        <p className="text-sm text-slate-400">
          Drag files here or <span className="text-indigo-400">browse</span>
        </p>
        {allowedTypes && (
          <p className="text-xs text-slate-500 mt-1">
            Allowed: {allowedTypes} (max {maxSizeMB}MB each)
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          onChange={handleSelect}
          className="hidden"
        />
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      {selectedFiles.length > 0 && (
        <ul className="space-y-1.5">
          {selectedFiles.map(({ file, id }) => (
            <li key={id} className="flex items-center gap-2 text-sm bg-slate-800/60 rounded-lg px-3 py-2">
              <File className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="text-slate-300 truncate flex-1">{file.name}</span>
              <span className="text-xs text-slate-500">{formatFileSize(file.size)}</span>
              <button type="button" onClick={() => removeFile(id)} className="text-slate-500 hover:text-rose-400">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
