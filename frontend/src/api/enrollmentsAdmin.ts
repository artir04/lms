import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/config/axios'

export interface CsvImportRow {
  email: string
  first_name: string
  last_name: string
  status: 'enrolled' | 'created_and_enrolled' | 'skipped' | 'error'
  detail: string | null
}

export interface CsvImportResult {
  total_rows: number
  created_users: number
  enrolled: number
  skipped: number
  errors: number
  rows: CsvImportRow[]
}

export interface EnrollmentHistoryEntry {
  action: string
  target_id: string | null
  summary: string | null
  actor_email: string | null
  event_metadata: Record<string, unknown> | null
  created_at: string
}

export interface TransferPayload {
  student_id: string
  from_section_id: string
  to_section_id: string
}

export const enrollmentAdminKeys = {
  all: ['admin-enrollments'] as const,
  history: (params: object) => [...enrollmentAdminKeys.all, 'history', params] as const,
}

export function useImportCsv() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      sectionId,
      file,
      createMissing = true,
    }: {
      sectionId: string
      file: File
      createMissing?: boolean
    }) => {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post('/admin/enrollments/import-csv', form, {
        params: { section_id: sectionId, create_missing: createMissing },
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data as CsvImportResult
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: enrollmentAdminKeys.all }),
  })
}

export function useTransferStudent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: TransferPayload) =>
      api.post('/admin/enrollments/transfer', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: enrollmentAdminKeys.all }),
  })
}

export function useEnrollmentHistory(params: {
  course_id?: string
  section_id?: string
  student_id?: string
  limit?: number
}) {
  return useQuery<EnrollmentHistoryEntry[]>({
    queryKey: enrollmentAdminKeys.history(params),
    queryFn: () =>
      api.get('/admin/enrollments/history', { params }).then((r) => r.data),
  })
}
