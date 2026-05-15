import { useQuery } from '@tanstack/react-query'
import api from '@/config/axios'
import type { PaginatedResponse } from '@/types/common'

export interface AuditTargetRef {
  type: string
  id: string
  label: string | null
  sublabel: string | null
}

export interface AuditUserRef {
  id: string
  full_name: string
  email: string
}

export interface AuditCourseRef {
  id: string
  title: string
}

export interface AuditSectionRef {
  id: string
  name: string
  course_id: string | null
  course_title: string | null
}

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
  target: AuditTargetRef | null
  student: AuditUserRef | null
  parent: AuditUserRef | null
  subject_user: AuditUserRef | null
  course: AuditCourseRef | null
  section: AuditSectionRef | null
  students: AuditUserRef[]
}

export interface AuditParams {
  page?: number
  page_size?: number
  action?: string
  actions?: string[]
  action_prefixes?: string[]
  target_type?: string
  target_types?: string[]
  target_id?: string
  actor_user_id?: string
  search?: string
  date_from?: string
  date_to?: string
}

export const auditKeys = {
  all: ['audit-logs'] as const,
  list: (p: AuditParams) => [...auditKeys.all, 'list', p] as const,
}

export function useAuditLogs(params: AuditParams) {
  return useQuery<PaginatedResponse<AuditEntry>>({
    queryKey: auditKeys.list(params),
    queryFn: () =>
      api
        .get('/audit/logs', {
          params,
          paramsSerializer: { indexes: null },
        })
        .then((r) => r.data),
  })
}
