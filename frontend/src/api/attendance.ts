import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/config/axios'
import type {
  AttendanceRead,
  AttendanceReport,
  AttendanceByDate,
  AttendanceCreateRequest,
  StudentAttendanceSummary,
} from '@/types/attendance'

export const attendanceKeys = {
  all: ['attendance'] as const,
  course: (courseId: string) => [...attendanceKeys.all, 'course', courseId] as const,
  courseByDate: (courseId: string, date: string) => [...attendanceKeys.course(courseId), 'date', date] as const,
  courseReport: (courseId: string) => [...attendanceKeys.course(courseId), 'report'] as const,
  student: (studentId: string) => [...attendanceKeys.all, 'student', studentId] as const,
  studentCourse: (studentId: string, courseId: string) => [...attendanceKeys.student(studentId), courseId] as const,
  me: () => [...attendanceKeys.all, 'me'] as const,
}

/**
 * Mark attendance for multiple students in a course
 * Roles: teacher, admin, superadmin
 */
export function useMarkAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ courseId, data }: { courseId: string; data: AttendanceCreateRequest }) =>
      api.post(`/attendance/courses/${courseId}`, data).then((r) => r.data),
    onSuccess: (_, { courseId, data }) => {
      // Invalidate attendance queries for this course
      qc.invalidateQueries({ queryKey: attendanceKeys.course(courseId) })
      qc.invalidateQueries({ queryKey: attendanceKeys.courseByDate(courseId, data.date) })
    },
  })
}

/**
 * Get attendance for a course on a specific date
 */
export function useAttendanceByDate(courseId: string, date: string) {
  return useQuery<AttendanceByDate>({
    queryKey: attendanceKeys.courseByDate(courseId, date),
    queryFn: () =>
      api
        .get(`/attendance/courses/${courseId}/date/${date}`)
        .then((r) => ({ date, records: r.data })),
    enabled: !!courseId && !!date,
  })
}

/**
 * Get attendance report for a course (with date range filtering)
 * Roles: teacher, admin, superadmin
 */
export function useAttendanceReport(courseId: string, params?: { date_from?: string; date_to?: string }) {
  return useQuery<AttendanceReport>({
    queryKey: [...attendanceKeys.courseReport(courseId), params],
    queryFn: () =>
      api.get(`/attendance/courses/${courseId}`, { params }).then((r) => r.data),
    enabled: !!courseId,
  })
}

/**
 * Get attendance for a specific student in a course
 */
export function useStudentAttendance(courseId: string, studentId: string) {
  return useQuery<AttendanceRead[]>({
    queryKey: attendanceKeys.studentCourse(studentId, courseId),
    queryFn: () =>
      api.get(`/attendance/courses/${courseId}/students/${studentId}`).then((r) => r.data),
    enabled: !!courseId && !!studentId,
  })
}

/**
 * Get current student's attendance across all courses
 * Roles: student
 */
export function useMyAttendance() {
  return useQuery<StudentAttendanceSummary[]>({
    queryKey: attendanceKeys.me(),
    queryFn: () => api.get('/attendance/students/me').then((r) => r.data),
  })
}
