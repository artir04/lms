import { useQuery } from '@tanstack/react-query'
import api from '@/config/axios'
import type { ParentDigest, ChildProgressDetail } from '@/types/parent'

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

export interface ChildGradeEntry {
  id: string
  category: string
  raw_score: number
  max_score: number
  letter_grade: string | null
}

export interface ChildGradeSummary {
  course_id: string
  course_title: string
  average: number
  letter_grade: string | null
  entries: ChildGradeEntry[]
}

export const parentKeys = {
  all: ['parents'] as const,
  children: () => [...parentKeys.all, 'children'] as const,
  child: (studentId: string) => [...parentKeys.all, 'child', studentId] as const,
  childGrades: (studentId: string) => [...parentKeys.child(studentId), 'grades'] as const,
  childAttendance: (studentId: string) => [...parentKeys.child(studentId), 'attendance'] as const,
}

function gradeToLetter(grade: number | null | undefined): string | null {
  if (grade === null || grade === undefined) return null
  if (grade >= 5) return 'A'
  if (grade >= 4) return 'B'
  if (grade >= 3) return 'C'
  if (grade >= 2) return 'D'
  return 'F'
}

export function useParentDigest() {
  return useQuery<ParentDigest>({
    queryKey: ['parent-digest'],
    queryFn: () => api.get('/parents/digest').then((r) => r.data),
  })
}

export function useChildProgress(studentId: string | undefined) {
  return useQuery<ChildProgressDetail>({
    queryKey: ['child-progress', studentId],
    queryFn: () => api.get(`/parents/children/${studentId}/progress`).then((r) => r.data),
    enabled: !!studentId,
  })
}

/**
 * Get all children linked to the current parent user.
 * Roles: parent
 */
export function useParentChildren() {
  return useQuery<ParentChild[]>({
    queryKey: parentKeys.children(),
    queryFn: () => api.get('/parents/me/children').then((r) => r.data),
  })
}

/**
 * Get overview information for a specific child.
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
 * Get grades for a specific child across all courses.
 * Roles: parent
 */
export function useChildGrades(studentId: string) {
  return useQuery<ChildGradeSummary[]>({
    queryKey: parentKeys.childGrades(studentId),
    queryFn: async () => {
      const response = await api.get(`/parents/me/children/${studentId}/grades`)
      return (response.data as any[]).map((summary) => ({
        course_id: summary.course_id,
        course_title: summary.course_title,
        average: summary.weighted_average,
        letter_grade: gradeToLetter(summary.final_grade),
        entries: (summary.entries ?? []).map((entry: any) => ({
          id: entry.id,
          category: entry.category,
          raw_score: entry.grade,
          max_score: 5,
          letter_grade: gradeToLetter(entry.grade),
        })),
      }))
    },
    enabled: !!studentId,
  })
}

/**
 * Get attendance records for a specific child across all courses.
 * Roles: parent
 */
export function useChildAttendance(studentId: string, params?: { date_from?: string; date_to?: string }) {
  return useQuery<any[]>({
    queryKey: [...parentKeys.childAttendance(studentId), params],
    queryFn: () => api.get(`/parents/me/children/${studentId}/attendance`, { params }).then((r) => r.data),
    enabled: !!studentId,
  })
}