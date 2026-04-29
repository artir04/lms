import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { ArrowLeft, Calendar, Check, X, Clock, FileText, Save } from 'lucide-react'
import { useCourse } from '@/api/courses'
import { useAttendanceByDate, useMarkAttendance } from '@/api/attendance'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'
import api from '@/config/axios'
import { useQuery } from '@tanstack/react-query'
import { toast } from '@/store/toastStore'
import type { AttendanceStatus, AttendanceRecord } from '@/types/attendance'

const STATUS_CONFIG: Record<AttendanceStatus, { icon: React.ReactNode; label: string; color: string; activeColor: string }> = {
  present: { icon: <Check className="h-4 w-4" />, label: 'Present', color: 'bg-surface-elevated text-ink-secondary border-border-strong hover:border-emerald-500/40', activeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' },
  absent: { icon: <X className="h-4 w-4" />, label: 'Absent', color: 'bg-surface-elevated text-ink-secondary border-border-strong hover:border-red-500/40', activeColor: 'bg-red-500/15 text-red-400 border-red-500/40' },
  tardy: { icon: <Clock className="h-4 w-4" />, label: 'Tardy', color: 'bg-surface-elevated text-ink-secondary border-border-strong hover:border-amber-500/40', activeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/40' },
  excused: { icon: <FileText className="h-4 w-4" />, label: 'Excused', color: 'bg-surface-elevated text-ink-secondary border-border-strong hover:border-slate-400/40', activeColor: 'bg-slate-500/15 text-slate-400 border-slate-400/40' },
}

export function AttendanceMarkingPage() {
  const { courseId } = useParams<{ courseId: string }>()!
  const { user } = useAuth()
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const [attendanceData, setAttendanceData] = useState<Record<string, AttendanceStatus>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})

  const { data: course, isLoading: courseLoading } = useCourse(courseId!)
  const { data: existingAttendance, isLoading: attendanceLoading } = useAttendanceByDate(courseId!, selectedDate)
  const { mutate: markAttendance, isPending: isSubmitting } = useMarkAttendance()

  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['students', courseId],
    queryFn: () => api.get(`/courses/${courseId}/enrollments`).then((r) => r.data),
    enabled: !!courseId,
  })

  const initializeAttendanceData = () => {
    if (existingAttendance && existingAttendance.records.length > 0) {
      const data: Record<string, AttendanceStatus> = {}
      const notesData: Record<string, string> = {}
      existingAttendance.records.forEach((record) => {
        data[record.student.id] = record.status as AttendanceStatus
        if (record.notes) notesData[record.student.id] = record.notes
      })
      setAttendanceData(data)
      setNotes(notesData)
    } else if (students && students.length > 0) {
      const data: Record<string, AttendanceStatus> = {}
      students.forEach((student: any) => { data[student.id] = 'present' })
      setAttendanceData(data)
    }
  }

  if ((students && !attendanceData && !existingAttendance) || (existingAttendance && Object.keys(attendanceData).length === 0)) {
    initializeAttendanceData()
  }

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceData((prev) => ({ ...prev, [studentId]: status }))
  }

  const handleNoteChange = (studentId: string, note: string) => {
    setNotes((prev) => ({ ...prev, [studentId]: note }))
  }

  const handleSubmit = () => {
    if (!courseId) return
    const records: AttendanceRecord[] = Object.entries(attendanceData).map(([studentId, status]) => ({
      student_id: studentId,
      status,
      notes: notes[studentId] || null,
    }))
    markAttendance({ courseId, data: { date: selectedDate, records } }, {
      onSuccess: () => {
        toast.success('Attendance saved', { title: 'Saved' })
      },
      onError: (err: any) => {
        const detail =
          err?.response?.data?.detail ??
          err?.response?.data?.message ??
          err?.message ??
          'Unknown error'
        const message = Array.isArray(detail)
          ? detail.map((d: any) => d?.msg ?? JSON.stringify(d)).join('\n')
          : typeof detail === 'string'
            ? detail
            : JSON.stringify(detail)
        toast.error(message, { title: 'Failed to save attendance' })
      },
    })
  }

  if (courseLoading || attendanceLoading || studentsLoading) return <PageLoader />
  if (!course) return <div className="text-center text-ink-muted py-16">Course not found</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`/courses/${courseId}`} className="text-ink-muted hover:text-ink-secondary transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-ink font-display">Mark Attendance</h1>
          <p className="text-sm text-ink-muted">{course.title}</p>
        </div>
      </div>

      {/* Date Selector */}
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <Calendar className="h-5 w-5 text-ink-muted" />
          <div className="flex-1">
            <label className="label">Attendance Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input"
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !students || students.length === 0}
            className="btn-primary"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Saving...' : 'Save Attendance'}
          </button>
        </div>
      </div>

      {/* Attendance List */}
      {!students || students.length === 0 ? (
        <div className="card p-12 text-center text-ink-muted">
          <p className="font-medium">No students enrolled in this course yet.</p>
        </div>
      ) : (
        <div className="card">
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ink-secondary">
                  {students.length} student{students.length !== 1 ? 's' : ''} enrolled
                </p>
                {existingAttendance && existingAttendance.records.length > 0 && (
                  <p className="text-xs text-ink-muted mt-1">
                    Attendance already recorded for this date. You can update it before saving.
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  const data: Record<string, AttendanceStatus> = {}
                  students.forEach((student: any) => { data[student.id] = 'present' })
                  setAttendanceData(data)
                }}
                className="btn-secondary btn-sm"
              >
                Mark All Present
              </button>
            </div>
          </div>

          <div className="divide-y divide-border/60">
            {students.map((student: any) => (
              <div key={student.id} className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500/15 flex items-center justify-center text-indigo-400 font-bold">
                    {student.full_name?.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-ink">{student.full_name}</p>
                        <p className="text-sm text-ink-muted">{student.email}</p>
                      </div>

                      <div className="flex gap-2 flex-shrink-0">
                        {(['present', 'absent', 'tardy', 'excused'] as AttendanceStatus[]).map((status) => {
                          const config = STATUS_CONFIG[status]
                          const isSelected = attendanceData[student.id] === status
                          return (
                            <button
                              key={status}
                              onClick={() => handleStatusChange(student.id, status)}
                              className={[
                                'px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all flex items-center gap-1.5',
                                isSelected ? config.activeColor : config.color,
                              ].join(' ')}
                            >
                              {config.icon}
                              <span className="hidden sm:inline">{config.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {attendanceData[student.id] === 'absent' || attendanceData[student.id] === 'tardy' ? (
                      <div className="mt-4">
                        <input
                          type="text"
                          value={notes[student.id] || ''}
                          onChange={(e) => handleNoteChange(student.id, e.target.value)}
                          placeholder={`Add a note for ${attendanceData[student.id]}...`}
                          className="input text-sm"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {students && students.length > 0 && Object.keys(attendanceData).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(['present', 'absent', 'tardy', 'excused'] as AttendanceStatus[]).map((status) => {
            const count = Object.values(attendanceData).filter((s) => s === status).length
            const config = STATUS_CONFIG[status]
            return (
              <div key={status} className={`card p-4 text-center ${config.activeColor}`}>
                <p className="text-2xl font-bold font-display">{count}</p>
                <p className="text-xs font-medium">{config.label}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
