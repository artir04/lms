import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/config/axios'

export interface School {
  id: string
  district_id: string
  name: string
  code: string
  academic_year: string | null
  principal_id: string | null
  is_active: boolean
  principal_name: string | null
  principal_email: string | null
  user_count: number
  course_count: number
}

export interface SchoolPayload {
  name: string
  code: string
  academic_year?: string | null
  principal_id?: string | null
}

export interface SchoolUpdatePayload extends Partial<SchoolPayload> {
  is_active?: boolean
}

export const schoolKeys = {
  all: ['schools'] as const,
  list: (includeInactive: boolean) => [...schoolKeys.all, 'list', includeInactive] as const,
}

export function useSchools(includeInactive = false) {
  return useQuery<School[]>({
    queryKey: schoolKeys.list(includeInactive),
    queryFn: () =>
      api
        .get('/tenants/me/schools', { params: { include_inactive: includeInactive } })
        .then((r) => r.data),
  })
}

export function useCreateSchool() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SchoolPayload) =>
      api.post('/tenants/me/schools', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: schoolKeys.all }),
  })
}

export function useUpdateSchool() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SchoolUpdatePayload }) =>
      api.patch(`/tenants/me/schools/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: schoolKeys.all }),
  })
}

export function useDeactivateSchool() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/tenants/me/schools/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: schoolKeys.all }),
  })
}
