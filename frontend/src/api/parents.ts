import { useQuery } from '@tanstack/react-query'
import api from '@/config/axios'

export interface ParentChild {
  student_id: string
  student_name: string
  email: string
  relationship: string
  is_primary_contact: boolean
  school_id: string | null
  last_login: string | null
}

export interface ChildOverview {
  student_id: string
  student_name: string
  email: string
  school_id: string | null
  is_active: boolean
  last_login: string | null
  created_at: string
  relationship: string
  is_primary_contact: boolean
}

export const parentKeys = {
  all: ['parents'] as const,
  children: () => [...parentKeys.all, 'children'] as const,
  child: (studentId: string) => [...parentKeys.all, 'child', studentId] as const,
  childGrades: (studentId: string) => [...parentKeys.child(studentId), 'grades'] as const,
  childAttendance: (studentId: string) => [...parentKeys.child(studentId), 'attendance'] as const,
}

/**
 * Get all children linked to the current parent user
 * Roles: parent
 */
export function useParentChildren() {
  return useQuery<ParentChild[]>({
    queryKey: parentKeys.children(),
    queryFn: () => api.get('/parents/me/children').then((r) => r.data),
  })
}

/**
 * Get overview information for a specific child
 * Roles: parent
 */
export function useChildOverview(studentId: string) {
  return useQuery<ChildOverview>({
    queryKey: parentKeys.child(studentId),
    queryFn: () => api.get(`/parents/me/children/${studentId}/overview`).then((r) => r.data),
    enabled: !!studentId,
  })
}

/**
 * Get grades for a specific child across all courses
 * Roles: parent
 */
export function useChildGrades(studentId: string) {
  return useQuery<any[]>({ // Using any[] to match StudentGradeSummary structure
    queryKey: parentKeys.childGrades(studentId),
    queryFn: () => api.get(`/parents/me/children/${studentId}/grades`).then((r) => r.data),
    enabled: !!studentId,
  })
}

/**
 * Get attendance records for a specific child across all courses
 * Roles: parent
 */
export function useChildAttendance(studentId: string, params?: { date_from?: string; date_to?: string }) {
  return useQuery<any[]>({ // Using any[] to match StudentAttendanceSummary structure
    queryKey: [...parentKeys.childAttendance(studentId), params],
    queryFn: () => api.get(`/parents/me/children/${studentId}/attendance`, { params }).then((r) => r.data),
    enabled: !!studentId,
  })
}