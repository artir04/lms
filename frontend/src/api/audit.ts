import { useQuery } from '@tanstack/react-query'
import api from '@/config/axios'
import type { PaginatedResponse } from '@/types/common'

export interface AuditEntry {
  id: string
  tenant_id: string
  actor_user_id: string | null
  actor_email: string | null
  actor_role: string | null
  action: string
  target_type: string | null
  target_id: string | null
  summary: string | null
  ip_address: string | null
  user_agent: string | null
  event_metadata: Record<string, unknown> | null
  created_at: string
}

export interface AuditParams {
  page?: number
  page_size?: number
  action?: string
  target_type?: string
  target_id?: string
  actor_user_id?: string
  search?: string
}

export const auditKeys = {
  all: ['audit-logs'] as const,
  list: (p: AuditParams) => [...auditKeys.all, 'list', p] as const,
}

export function useAuditLogs(params: AuditParams) {
  return useQuery<PaginatedResponse<AuditEntry>>({
    queryKey: auditKeys.list(params),
    queryFn: () => api.get('/audit/logs', { params }).then((r) => r.data),
  })
}
