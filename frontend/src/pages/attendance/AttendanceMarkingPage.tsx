import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { ArrowLeft, Calendar, Check, X, Clock, FileText, Save } from 'lucide-react'
import { useCourse } from '@/api/courses'
import { useAttendanceByDate, useMarkAttendance } from '@/api/attendance'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'
import { useForm } from 'react-hook-form'
import api from '@/config/axios'
import { useQuery } from '@tanstack/react-query'
import type { AttendanceStatus, AttendanceRecord } from '@/types/attendance'

const STATUS_CONFIG: Record<AttendanceStatus, { icon: React.ReactNode; label: string; color: string }> = {
  present: { icon: <Check className="h-4 w-4" />, label: 'Present', color: 'bg-green-50 text-green-700 border-green-200' },
  absent: { icon: <X className="h-4 w-4" />, label: 'Absent', color: 'bg-red-50 text-red-700 border-red-200' },
  tardy: { icon: <Clock className="h-4 w-4" />, label: 'Tardy', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  excused: { icon: <FileText className="h-4 w-4" />, label: 'Excused', color: 'bg-slate-50 text-slate-700 border-slate-200' },
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

  // Fetch enrolled students
  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['students', courseId],
    queryFn: () => api.get(`/courses/${courseId}/enrollments`).then((r) => r.data),
    enabled: !!courseId,
  })

  // Initialize attendance data from existing records or default to 'present'
  const initializeAttendanceData = () => {
    if (existingAttendance && existingAttendance.records.length > 0) {
      const data: Record<string, AttendanceStatus> = {}
      const notesData: Record<string, string> = {}
      existingAttendance.records.forEach((record) => {
        data[record.student.id] = record.status as AttendanceStatus
        if (record.notes) {
          notesData[record.student.id] = record.notes
        }
      })
      setAttendanceData(data)
      setNotes(notesData)
    } else if (students && students.length > 0) {
      // Default all students to present
      const data: Record<string, AttendanceStatus> = {}
      students.forEach((student: any) => {
        data[student.id] = 'present'
      })
      setAttendanceData(data)
    }
  }

  // Update attendance data when students or existing attendance loads
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

    markAttendance(
      {
        courseId,
        data: {
          date: selectedDate,
          records,
        },
      },
      {
        onSuccess: () => {
          alert('Attendance marked successfully!')
        },
      }
    )
  }

  if (courseLoading || attendanceLoading || studentsLoading) return <PageLoader />
  if (!course) return <div className="text-center text-slate-500 py-16">Course not found</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/courses/${courseId}`} className="text-slate-500 hover:text-slate-400">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Mark Attendance</h1>
          <p className="text-sm text-slate-500">{course.title}</p>
        </div>
      </div>

      {/* Date Selector */}
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <Calendar className="h-5 w-5 text-slate-400" />
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
        <div className="card p-12 text-center text-slate-400">
          <p className="font-medium">No students enrolled in this course yet.</p>
        </div>
      ) : (
        <div className="card">
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">
                  {students.length} student{students.length !== 1 ? 's' : ''} enrolled
                </p>
                {existingAttendance && existingAttendance.records.length > 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    Attendance already recorded for this date. You can update it before saving.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const data: Record<string, AttendanceStatus> = {}
                    students.forEach((student: any) => {
                      data[student.id] = 'present'
                    })
                    setAttendanceData(data)
                  }}
                  className="btn-secondary btn-sm"
                >
                  Mark All Present
                </button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-700/40">
            {students.map((student: any) => (
              <div key={student.id} className="p-6">
                <div className="flex items-start gap-4">
                  {/* Student Avatar */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                    {student.full_name?.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-white">{student.full_name}</p>
                        <p className="text-sm text-slate-500">{student.email}</p>
                      </div>

                      {/* Status Buttons */}
                      <div className="flex gap-2 flex-shrink-0">
                        {(['present', 'absent', 'tardy', 'excused'] as AttendanceStatus[]).map((status) => {
                          const config = STATUS_CONFIG[status]
                          const isSelected = attendanceData[student.id] === status
                          return (
                            <button
                              key={status}
                              onClick={() => handleStatusChange(student.id, status)}
                              className={[
                                'px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all flex items-center gap-1.5',
                                isSelected ? config.color : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300',
                              ].join(' ')}
                            >
                              {config.icon}
                              <span className="hidden sm:inline">{config.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Notes Field */}
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
              <div key={status} className={['card p-4 text-center', config.color].join(' ')}>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs font-medium">{config.label}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
