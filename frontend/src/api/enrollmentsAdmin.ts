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

export interface EnrollmentHistoryRef {
  id: string
  title?: string
  name?: string
  course_id?: string | null
  course_title?: string | null
}

export interface EnrollmentHistoryStudent {
  id: string
  full_name: string
  email: string
}

export interface EnrollmentHistoryEntry {
  id?: string
  action: string
  target_type: string | null
  target_id: string | null
  summary: string | null
  actor_email: string | null
  actor_user_id: string | null
  actor_role: string | null
  ip_address: string | null
  user_agent: string | null
  event_metadata: Record<string, unknown> | null
  created_at: string
  student: EnrollmentHistoryStudent | null
  students: EnrollmentHistoryStudent[]
  course: EnrollmentHistoryRef | null
  section: EnrollmentHistoryRef | null
  from_course: EnrollmentHistoryRef | null
  to_course: EnrollmentHistoryRef | null
  from_section: EnrollmentHistoryRef | null
  to_section: EnrollmentHistoryRef | null
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

export interface EnrollmentHistoryFilters {
  course_id?: string
  section_id?: string
  student_id?: string
  actions?: string[]
  date_from?: string
  date_to?: string
  limit?: number
}

export function useEnrollmentHistory(filters: EnrollmentHistoryFilters) {
  return useQuery<EnrollmentHistoryEntry[]>({
    queryKey: enrollmentAdminKeys.history(filters),
    queryFn: () =>
      api
        .get('/admin/enrollments/history', {
          params: filters,
          // Repeat ?actions=... for each value so FastAPI parses a list
          paramsSerializer: { indexes: null },
        })
        .then((r) => r.data),
  })
}
