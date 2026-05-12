import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/config/axios'

export interface ParentLink {
  id: string
  parent_id: string
  parent_name: string
  parent_email: string
  student_id: string
  student_name: string
  student_email: string
  relationship_name: string | null
  is_primary_contact: boolean
  created_at: string
}

export interface ParentLinkPage {
  items: ParentLink[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface RelationshipType {
  id: number
  name: string
  description: string | null
}

export interface ParentLinkCreate {
  parent_id: string
  student_id: string
  relationship_id?: number
  is_primary_contact?: boolean
}

export const parentLinkKeys = {
  all: ['parent-links'] as const,
  list: (params: object) => [...parentLinkKeys.all, 'list', params] as const,
  relationships: () => [...parentLinkKeys.all, 'relationships'] as const,
}

export function useParentLinks(params: { page?: number; page_size?: number; search?: string }) {
  return useQuery<ParentLinkPage>({
    queryKey: parentLinkKeys.list(params),
    queryFn: () => api.get('/parents/links', { params }).then((r) => r.data),
  })
}

export function useRelationshipTypes() {
  return useQuery<RelationshipType[]>({
    queryKey: parentLinkKeys.relationships(),
    queryFn: () => api.get('/parents/relationships').then((r) => r.data),
  })
}

export function useCreateParentLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ParentLinkCreate) =>
      api.post('/parents/links', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: parentLinkKeys.all }),
  })
}

export function useDeleteParentLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (linkId: string) =>
      api.delete(`/parents/links/${linkId}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: parentLinkKeys.all }),
  })
}
