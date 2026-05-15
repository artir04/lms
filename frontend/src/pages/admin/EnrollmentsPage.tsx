import { Fragment, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowRightLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Filter,
  Hash,
  History,
  RotateCcw,
  Search,
  Upload,
  User as UserIcon,
  Users as UsersIcon,
  X as XIcon,
} from 'lucide-react'

import api from '@/config/axios'
import { PageLoader } from '@/components/ui/Spinner'
import {
  CsvImportResult,
  EnrollmentHistoryEntry,
  useEnrollmentHistory,
  useImportCsv,
  useTransferStudent,
} from '@/api/enrollmentsAdmin'
import { useAdminCourses } from '@/api/adminCourses'
import { useCourseSections } from '@/api/courses'
import { formatDateTime, timeAgo } from '@/utils/formatters'

type Tab = 'import' | 'transfer' | 'history'

export function EnrollmentsPage() {
  const [tab, setTab] = useState<Tab>('import')

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'import', label: 'CSV Import', icon: Upload },
    { key: 'transfer', label: 'Transfer Student', icon: ArrowRightLeft },
    { key: 'history', label: 'Enrollment History', icon: History },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-ink font-display">Enrollment Manager</h2>
        <p className="text-sm text-ink-muted mt-1">
          Bulk-import class rosters, transfer students between sections, and audit enrollment activity.
        </p>
      </div>

      <div className="flex gap-2 border-b border-border pb-px">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ' +
              (tab === t.key
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-ink-muted hover:text-ink-secondary')
            }
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'import' && <CsvImportPanel />}
      {tab === 'transfer' && <TransferPanel />}
      {tab === 'history' && <HistoryPanel />}
    </div>
  )
}

function useCourseList() {
  return useAdminCourses({ page: 1, page_size: 100, status: 'active' })
}

function downloadCsvTemplate() {
  const csv = 'email,first_name,last_name\nstudent1@example.com,Ada,Lovelace\nstudent2@example.com,Linus,Torvalds\n'
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'roster-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function CsvImportPanel() {
  const { data: courses, isLoading: coursesLoading } = useCourseList()
  const [courseId, setCourseId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [createMissing, setCreateMissing] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<CsvImportResult | null>(null)
  const { mutate, isPending, error } = useImportCsv()
  const sectionsQuery = useCourseSections(courseId)

  const apiDetail = (error as { response?: { data?: { detail?: unknown } } } | null)?.response?.data?.detail

  const handleSubmit = () => {
    if (!sectionId || !file) return
    mutate(
      { sectionId, file, createMissing },
      {
        onSuccess: (res) => setResult(res),
      }
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 card p-5 space-y-4">
        <h3 className="text-base font-semibold text-ink font-display flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-primary-400" /> Import roster
        </h3>

        <div>
          <label className="label">Course</label>
          <select
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value)
              setSectionId('')
            }}
            className="input"
            disabled={coursesLoading}
          >
            <option value="">— Select course —</option>
            {courses?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.teacher_name})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Section</label>
          <select
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            className="input"
            disabled={!courseId}
          >
            <option value="">— Select section —</option>
            {sectionsQuery.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.enrollment_count} enrolled)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">CSV file</label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="input file:bg-surface-overlay file:border-0 file:text-ink file:rounded-md file:px-3 file:py-1 file:mr-3"
          />
          <p className="text-xs text-ink-muted mt-1">
            Required columns: <code>email</code>, <code>first_name</code>, <code>last_name</code>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="create_missing"
            type="checkbox"
            checked={createMissing}
            onChange={(e) => setCreateMissing(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="create_missing" className="text-sm text-ink-secondary">
            Auto-create students that don't exist yet
          </label>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!sectionId || !file || isPending}
          className="btn-primary w-full"
        >
          <Upload className="h-4 w-4" /> {isPending ? 'Importing…' : 'Import'}
        </button>

        <button onClick={downloadCsvTemplate} className="btn-secondary w-full text-xs">
          <Download className="h-3.5 w-3.5" /> Download template
        </button>

        {!!apiDetail && (
          <p className="text-sm text-rose-400 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" /> {typeof apiDetail === 'string' ? apiDetail : 'Import failed'}
          </p>
        )}
      </div>

      <div className="lg:col-span-2">
        {result ? (
          <ImportResult result={result} onReset={() => setResult(null)} />
        ) : (
          <div className="card p-12 text-center text-ink-muted">
            <FileSpreadsheet className="h-10 w-10 mx-auto mb-3" />
            Import a CSV to see results here.
          </div>
        )}
      </div>
    </div>
  )
}

function ImportResult({ result, onReset }: { result: CsvImportResult; onReset: () => void }) {
  const counters: { label: string; value: number; color: string }[] = [
    { label: 'Total rows', value: result.total_rows, color: 'text-ink' },
    { label: 'Newly enrolled', value: result.enrolled, color: 'text-emerald-400' },
    { label: 'Users created', value: result.created_users, color: 'text-sky-400' },
    { label: 'Skipped', value: result.skipped, color: 'text-amber-400' },
    { label: 'Errors', value: result.errors, color: 'text-rose-400' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {counters.map((c) => (
          <div key={c.label} className="card p-3 text-center">
            <p className={`text-xl font-bold ${c.color} font-display`}>{c.value}</p>
            <p className="text-[10px] text-ink-muted uppercase mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-elevated/50 border-b border-border">
              <th className="px-4 py-2 text-left text-xs font-medium text-ink-muted uppercase">Email</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-ink-muted uppercase">Name</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-ink-muted uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {result.rows.map((row, idx) => (
              <tr key={idx}>
                <td className="px-4 py-2 text-ink-secondary">{row.email}</td>
                <td className="px-4 py-2 text-ink-secondary">{row.first_name} {row.last_name}</td>
                <td className="px-4 py-2">
                  {row.status === 'error' && <span className="badge badge-red text-[10px]">Error</span>}
                  {row.status === 'skipped' && <span className="badge badge-yellow text-[10px]">Skipped</span>}
                  {row.status === 'enrolled' && <span className="badge badge-green text-[10px]">Enrolled</span>}
                  {row.status === 'created_and_enrolled' && <span className="badge badge-blue text-[10px]">Created</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={onReset} className="btn-secondary">
        Import another file
      </button>
    </div>
  )
}

function TransferPanel() {
  const { data: courses, isLoading: coursesLoading } = useCourseList()
  const [fromCourse, setFromCourse] = useState('')
  const [toCourse, setToCourse] = useState('')
  const [fromSection, setFromSection] = useState('')
  const [toSection, setToSection] = useState('')
  const [studentId, setStudentId] = useState('')
  const { mutate, isPending, error } = useTransferStudent()
  const [done, setDone] = useState(false)

  const fromSectionsQ = useCourseSections(fromCourse)
  const toSectionsQ = useCourseSections(toCourse)

  const rosterQuery = useQuery<{ id: string; full_name: string; email: string }[]>({
    queryKey: ['course-enrollments', fromCourse, fromSection],
    queryFn: () =>
      api
        .get(`/courses/${fromCourse}/enrollments`, { params: { section_id: fromSection } })
        .then((r) => r.data),
    enabled: !!fromCourse && !!fromSection,
  })

  const apiDetail = (error as { response?: { data?: { detail?: unknown } } } | null)?.response?.data?.detail

  const submit = () => {
    if (!studentId || !fromSection || !toSection) return
    setDone(false)
    mutate(
      { student_id: studentId, from_section_id: fromSection, to_section_id: toSection },
      { onSuccess: () => setDone(true) }
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
      <div className="card p-5 space-y-4">
        <h3 className="text-base font-semibold text-ink font-display flex items-center gap-2">
          <UsersIcon className="h-4 w-4 text-primary-400" /> From
        </h3>
        <div>
          <label className="label">Source course</label>
          <select
            value={fromCourse}
            onChange={(e) => {
              setFromCourse(e.target.value)
              setFromSection('')
              setStudentId('')
            }}
            className="input"
            disabled={coursesLoading}
          >
            <option value="">— Select course —</option>
            {courses?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Source section</label>
          <select
            value={fromSection}
            onChange={(e) => {
              setFromSection(e.target.value)
              setStudentId('')
            }}
            className="input"
            disabled={!fromCourse}
          >
            <option value="">— Select section —</option>
            {fromSectionsQ.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Student</label>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="input"
            disabled={!fromSection}
          >
            <option value="">
              {!fromSection
                ? '— Select a section first —'
                : rosterQuery.isLoading
                  ? 'Loading students…'
                  : rosterQuery.data && rosterQuery.data.length === 0
                    ? 'No students enrolled in this section'
                    : '— Select student —'}
            </option>
            {rosterQuery.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} — {s.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="text-base font-semibold text-ink font-display flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-primary-400" /> To
        </h3>
        <div>
          <label className="label">Destination course</label>
          <select
            value={toCourse}
            onChange={(e) => {
              setToCourse(e.target.value)
              setToSection('')
            }}
            className="input"
            disabled={coursesLoading}
          >
            <option value="">— Select course —</option>
            {courses?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Destination section</label>
          <select
            value={toSection}
            onChange={(e) => setToSection(e.target.value)}
            className="input"
            disabled={!toCourse}
          >
            <option value="">— Select section —</option>
            {toSectionsQ.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={submit}
          disabled={!studentId || !fromSection || !toSection || isPending}
          className="btn-primary w-full"
        >
          <ArrowRightLeft className="h-4 w-4" /> {isPending ? 'Transferring…' : 'Transfer Student'}
        </button>

        {!!apiDetail && (
          <p className="text-sm text-rose-400 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" /> {typeof apiDetail === 'string' ? apiDetail : 'Transfer failed'}
          </p>
        )}
        {done && (
          <p className="text-sm text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" /> Student transferred.
          </p>
        )}
      </div>
    </div>
  )
}

const ACTION_LABEL: Record<string, string> = {
  'enrollment.create': 'Enrolled',
  'enrollment.drop': 'Dropped',
  'enrollment.transfer': 'Transferred',
  'enrollment.csv_import': 'CSV import',
}

const ACTION_BADGE: Record<string, string> = {
  'enrollment.create': 'badge-green',
  'enrollment.drop': 'badge-red',
  'enrollment.transfer': 'badge-blue',
  'enrollment.csv_import': 'badge-purple',
}

const ROLE_BADGE: Record<string, string> = {
  superadmin: 'badge-purple',
  admin: 'badge-blue',
  teacher: 'badge-green',
  student: 'badge-gray',
}

const ALL_ACTIONS = [
  'enrollment.create',
  'enrollment.drop',
  'enrollment.transfer',
  'enrollment.csv_import',
] as const

function useStudentSearch(term: string) {
  const trimmed = term.trim()
  return useQuery<{ items: { id: string; first_name: string; last_name: string; email: string }[] }>({
    queryKey: ['users-students', trimmed],
    queryFn: () =>
      api
        .get('/users', { params: { role: 'student', page_size: 20, search: trimmed || undefined } })
        .then((r) => r.data),
    enabled: trimmed.length === 0 || trimmed.length >= 2,
  })
}

function describeWhere(entry: EnrollmentHistoryEntry): string {
  if (entry.action === 'enrollment.transfer') {
    const from = formatPlace(entry.from_course, entry.from_section)
    const to = formatPlace(entry.to_course, entry.to_section)
    if (from || to) return `${from || '—'} → ${to || '—'}`
  }
  return formatPlace(entry.course ?? null, entry.section ?? null) || '—'
}

function formatPlace(
  course: { title?: string | null } | null,
  section: { name?: string | null } | null,
): string {
  const parts: string[] = []
  if (course?.title) parts.push(course.title)
  if (section?.name) parts.push(`§ ${section.name}`)
  return parts.join(' · ')
}

function csvImportCounts(entry: EnrollmentHistoryEntry) {
  if (entry.action !== 'enrollment.csv_import') return null
  const md = entry.event_metadata ?? {}
  const num = (k: string) => (typeof md[k] === 'number' ? (md[k] as number) : null)
  return {
    total: num('total_rows'),
    enrolled: num('enrolled'),
    created: num('created'),
    skipped: num('skipped'),
    errors: num('errors'),
  }
}

function exportHistoryCsv(rows: EnrollmentHistoryEntry[]) {
  const headers = [
    'when',
    'action',
    'actor_email',
    'actor_role',
    'student_name',
    'student_email',
    'course',
    'section',
    'from',
    'to',
    'summary',
    'ip_address',
    'user_agent',
  ]
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.join(',')]
  for (const e of rows) {
    lines.push(
      [
        e.created_at,
        ACTION_LABEL[e.action] ?? e.action,
        e.actor_email,
        e.actor_role,
        e.student?.full_name ??
          (e.students && e.students.length > 0
            ? e.students.map((s) => s.full_name).join('; ')
            : ''),
        e.student?.email ??
          (e.students && e.students.length > 0
            ? e.students.map((s) => s.email).join('; ')
            : ''),
        e.course?.title ?? '',
        e.section?.name ?? '',
        formatPlace(e.from_course, e.from_section),
        formatPlace(e.to_course, e.to_section),
        e.summary,
        e.ip_address,
        e.user_agent,
      ]
        .map(escape)
        .join(','),
    )
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `enrollment-history-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function HistoryPanel() {
  const { data: courses } = useCourseList()
  const [courseFilter, setCourseFilter] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [studentFilter, setStudentFilter] = useState<{ id: string; label: string } | null>(null)
  const [studentTerm, setStudentTerm] = useState('')
  const [actions, setActions] = useState<string[]>([...ALL_ACTIONS])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const sectionsQ = useCourseSections(courseFilter)
  const studentsQ = useStudentSearch(studentTerm)

  const filters = useMemo(
    () => ({
      course_id: courseFilter || undefined,
      section_id: sectionFilter || undefined,
      student_id: studentFilter?.id,
      actions: actions.length === ALL_ACTIONS.length ? undefined : actions,
      date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      date_to: dateTo ? new Date(dateTo).toISOString() : undefined,
      limit: 200,
    }),
    [courseFilter, sectionFilter, studentFilter, actions, dateFrom, dateTo],
  )

  const { data, isLoading, isFetching } = useEnrollmentHistory(filters)

  const toggleAction = (a: string) =>
    setActions((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]))

  const resetFilters = () => {
    setCourseFilter('')
    setSectionFilter('')
    setStudentFilter(null)
    setStudentTerm('')
    setActions([...ALL_ACTIONS])
    setDateFrom('')
    setDateTo('')
  }

  const activeFilterCount =
    (courseFilter ? 1 : 0) +
    (sectionFilter ? 1 : 0) +
    (studentFilter ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (actions.length !== ALL_ACTIONS.length ? 1 : 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button
          onClick={() => data && exportHistoryCsv(data)}
          disabled={!data || data.length === 0}
          className="btn-secondary text-xs whitespace-nowrap"
        >
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>

      <div className="card p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <Filter className="h-4 w-4 text-primary-400" />
          <h3 className="text-sm font-semibold text-ink">Filters</h3>
          {activeFilterCount > 0 && (
            <span className="badge badge-blue text-[10px]">{activeFilterCount} active</span>
          )}
          <div className="flex-1" />
          {activeFilterCount > 0 && (
            <button onClick={resetFilters} className="btn-secondary text-xs">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-6 relative">
            {studentFilter ? (
              <div className="input pl-10 flex items-center justify-between">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
                <span className="truncate text-sm text-ink">{studentFilter.label}</span>
                <button
                  onClick={() => {
                    setStudentFilter(null)
                    setStudentTerm('')
                  }}
                  className="text-ink-muted hover:text-ink ml-2"
                  aria-label="Clear student filter"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
                <input
                  value={studentTerm}
                  onChange={(e) => setStudentTerm(e.target.value)}
                  placeholder="Search a student by name or email…"
                  className="input pl-10"
                />
                {studentTerm.trim().length >= 2 && studentsQ.data && studentsQ.data.items.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full card max-h-56 overflow-auto text-sm">
                    {studentsQ.data.items.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setStudentFilter({
                            id: s.id,
                            label: `${s.first_name} ${s.last_name} — ${s.email}`,
                          })
                          setStudentTerm('')
                        }}
                        className="block w-full text-left px-3 py-2 hover:bg-surface-elevated"
                      >
                        <div className="text-ink">{s.first_name} {s.last_name}</div>
                        <div className="text-xs text-ink-muted">{s.email}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
              <input
                type="datetime-local"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input pl-10"
                aria-label="From date"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
              <input
                type="datetime-local"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input pl-10"
                aria-label="To date"
              />
            </div>
          </div>
          <div className="lg:col-span-6 relative">
            <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
            <select
              value={courseFilter}
              onChange={(e) => {
                setCourseFilter(e.target.value)
                setSectionFilter('')
              }}
              className="input pl-10"
              aria-label="Course"
            >
              <option value="">All courses</option>
              {courses?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-6 relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="input pl-10"
              disabled={!courseFilter}
              aria-label="Section"
            >
              <option value="">{courseFilter ? 'All sections' : 'Pick a course first'}</option>
              {sectionsQ.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <p className="text-[10px] text-ink-muted uppercase mb-1.5">Action</p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_ACTIONS.map((a) => {
              const on = actions.includes(a)
              return (
                <button
                  key={a}
                  onClick={() => toggleAction(a)}
                  className={
                    'badge text-[10px] cursor-pointer transition ' +
                    (on ? ACTION_BADGE[a] : 'badge-gray opacity-60 hover:opacity-100')
                  }
                >
                  {ACTION_LABEL[a]}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : data && data.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="px-4 py-2 flex items-center justify-between border-b border-border bg-surface-elevated/30">
            <p className="text-xs text-ink-muted">
              Showing {data.length} {data.length === 1 ? 'event' : 'events'}
              {isFetching && <span className="ml-2 italic">refreshing…</span>}
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-elevated/50 border-b border-border">
                <th className="px-3 py-2 w-6"></th>
                <th className="px-3 py-2 text-left text-xs font-medium text-ink-muted uppercase">When</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-ink-muted uppercase">Action</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-ink-muted uppercase">Actor</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-ink-muted uppercase">Student</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-ink-muted uppercase">Where</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-ink-muted uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {data.map((entry, idx) => {
                const key = entry.id ?? `${entry.created_at}-${idx}`
                const isOpen = expanded === key
                const counts = csvImportCounts(entry)
                return (
                  <Fragment key={key}>
                    <tr className="hover:bg-surface-elevated/30">
                      <td className="px-3 py-2 align-top">
                        <button
                          onClick={() => setExpanded(isOpen ? null : key)}
                          className="text-ink-muted hover:text-ink"
                          aria-label={isOpen ? 'Collapse row' : 'Expand row'}
                        >
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-ink-muted whitespace-nowrap" title={formatDateTime(entry.created_at)}>
                        {timeAgo(entry.created_at)}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span className={'text-[10px] ' + (ACTION_BADGE[entry.action] ?? 'badge-gray')}>
                          {ACTION_LABEL[entry.action] ?? entry.action}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top text-xs">
                        <div className="text-ink-secondary truncate max-w-[200px]" title={entry.actor_email ?? ''}>
                          {entry.actor_email ?? '—'}
                        </div>
                        {entry.actor_role && (
                          <span
                            className={
                              'text-[9px] mt-1 ' +
                              (ROLE_BADGE[entry.actor_role.toLowerCase()] ?? 'badge-gray')
                            }
                          >
                            {entry.actor_role}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-xs">
                        {entry.student ? (
                          <>
                            <div className="text-ink">{entry.student.full_name}</div>
                            <div className="text-ink-muted">{entry.student.email}</div>
                          </>
                        ) : entry.students && entry.students.length > 0 ? (
                          <>
                            <div className="text-ink">{entry.students[0].full_name}</div>
                            {entry.students.length > 1 && (
                              <div className="text-ink-muted">
                                +{entry.students.length - 1} more
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-ink-secondary">
                        {describeWhere(entry)}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-ink-secondary">
                        {counts ? (
                          <div className="flex flex-wrap gap-1">
                            {counts.total !== null && (
                              <span className="badge badge-gray text-[9px]">{counts.total} rows</span>
                            )}
                            {counts.enrolled !== null && counts.enrolled > 0 && (
                              <span className="badge badge-green text-[9px]">{counts.enrolled} enrolled</span>
                            )}
                            {counts.created !== null && counts.created > 0 && (
                              <span className="badge badge-blue text-[9px]">{counts.created} created</span>
                            )}
                            {counts.skipped !== null && counts.skipped > 0 && (
                              <span className="badge badge-yellow text-[9px]">{counts.skipped} skipped</span>
                            )}
                            {counts.errors !== null && counts.errors > 0 && (
                              <span className="badge badge-red text-[9px]">{counts.errors} errors</span>
                            )}
                          </div>
                        ) : (
                          entry.summary ?? '—'
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-surface-elevated/40">
                        <td colSpan={7} className="px-6 py-3 text-xs text-ink-secondary">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-[10px] text-ink-muted uppercase mb-1">Summary</p>
                              <p>{entry.summary ?? '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-ink-muted uppercase mb-1">IP / User agent</p>
                              <p className="break-all">{entry.ip_address ?? '—'}</p>
                              <p className="break-all text-ink-muted">{entry.user_agent ?? '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-ink-muted uppercase mb-1">Target</p>
                              <p>
                                {entry.target_type ?? '—'}
                                {entry.target_id ? ` · ${entry.target_id}` : ''}
                              </p>
                            </div>
                          </div>
                          {entry.students && entry.students.length > 0 && (
                            <details className="mt-3" open>
                              <summary className="cursor-pointer text-[10px] text-ink-muted uppercase">
                                Students affected ({entry.students.length})
                              </summary>
                              <ul className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs">
                                {entry.students.map((s) => (
                                  <li key={s.id} className="flex justify-between gap-2">
                                    <span className="text-ink truncate">{s.full_name}</span>
                                    <span className="text-ink-muted truncate">{s.email}</span>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                          <details className="mt-3">
                            <summary className="cursor-pointer text-[10px] text-ink-muted uppercase">
                              Raw event_metadata
                            </summary>
                            <pre className="mt-2 p-3 rounded bg-surface-overlay text-[11px] overflow-x-auto">
                              {JSON.stringify(entry.event_metadata ?? {}, null, 2)}
                            </pre>
                          </details>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card p-12 text-center text-ink-muted">
          <History className="h-10 w-10 mx-auto mb-3" /> No enrollment events match the current filters.
        </div>
      )}
    </div>
  )
}
