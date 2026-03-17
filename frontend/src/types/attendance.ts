import { UserSummary } from './user'

export type AttendanceStatus = 'present' | 'absent' | 'tardy' | 'excused'

export interface AttendanceRecord {
  student_id: string
  status: AttendanceStatus
  notes: string | null
}

export interface AttendanceCreateRequest {
  date: string // YYYY-MM-DD format
  records: AttendanceRecord[]
}

export interface AttendanceRead {
  id: string
  date: string // YYYY-MM-DD format
  student: UserSummary
  status: AttendanceStatus
  notes: string | null
  teacher: UserSummary
  created_at: string
}

export interface AttendanceReportRow {
  student_id: string
  student_name: string
  email: string
  attendance_count: number
  present_count: number
  absent_count: number
  tardy_count: number
  attendance_rate: number
}

export interface AttendanceReport {
  course_id: string
  date_range_start: string | null
  date_range_end: string | null
  rows: AttendanceReportRow[]
}

export interface StudentAttendanceSummary {
  course_id: string
  course_title: string
  attendance_records: AttendanceRead[]
  attendance_rate: number
}

export interface AttendanceByDate {
  date: string
  records: AttendanceRead[]
}
