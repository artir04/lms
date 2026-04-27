import { useQuery } from '@tanstack/react-query'
import api from '@/config/axios'

export interface TeacherCourseAttendance {
  course_id: string
  course_title: string
  student_count: number
  marked_today: boolean
  today_present: number
  today_absent: number
  today_tardy: number
  today_excused: number
}

export interface TeacherAttendanceOverview {
  date: string
  courses: TeacherCourseAttendance[]
}

export interface TeacherStudent {
  id: string
  first_name: string
  last_name: string
  full_name: string
  email: string
  avatar_url: string | null
  course_count: number
  courses: { id: string; title: string }[]
}

export function useTeacherAttendanceOverview() {
  return useQuery<TeacherAttendanceOverview>({
    queryKey: ['attendance', 'teacher', 'overview'],
    queryFn: () => api.get('/attendance/teacher/overview').then((r) => r.data),
  })
}

export function useTeacherStudents() {
  return useQuery<TeacherStudent[]>({
    queryKey: ['users', 'teacher', 'students'],
    queryFn: () => api.get('/users/teacher/students').then((r) => r.data),
  })
}
