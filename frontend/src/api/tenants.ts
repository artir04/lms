import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/config/axios'

export type TenantSettings = Record<string, unknown>

export function useTenantSettings() {
  return useQuery<TenantSettings>({
    queryKey: ['tenants', 'me', 'settings'],
    queryFn: () => api.get<TenantSettings>('/tenants/me/settings').then((r) => r.data),
  })
}

export function useUpdateTenantSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: TenantSettings) =>
      api.patch<TenantSettings>('/tenants/me/settings', patch).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(['tenants', 'me', 'settings'], data)
    },
  })
}
