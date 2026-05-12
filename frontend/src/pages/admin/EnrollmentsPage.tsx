import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  History,
  Upload,
  Users as UsersIcon,
} from 'lucide-react'

import api from '@/config/axios'
import { PageLoader } from '@/components/ui/Spinner'
import {
  CsvImportResult,
  useEnrollmentHistory,
  useImportCsv,
  useTransferStudent,
} from '@/api/enrollmentsAdmin'
import { useAdminCourses } from '@/api/adminCourses'
import { useCourseSections } from '@/api/courses'
import { formatDateTime } from '@/utils/formatters'

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
              <th className="px-4 py-2 text-left text-xs font-medium text-ink-muted uppercase">Detail</th>
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
                <td className="px-4 py-2 text-xs text-ink-muted">{row.detail ?? '—'}</td>
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
    queryKey: ['course-enrollments', fromCourse],
    queryFn: () => api.get(`/courses/${fromCourse}/enrollments`).then((r) => r.data),
    enabled: !!fromCourse,
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
            onChange={(e) => setFromSection(e.target.value)}
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
            disabled={!fromCourse}
          >
            <option value="">— Select student —</option>
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

function HistoryPanel() {
  const { data: courses } = useCourseList()
  const [courseFilter, setCourseFilter] = useState('')
  const { data, isLoading } = useEnrollmentHistory({
    course_id: courseFilter || undefined,
    limit: 100,
  })

  const labelMap = useMemo<Record<string, string>>(
    () => ({
      'enrollment.create': 'Enrolled',
      'enrollment.drop': 'Dropped',
      'enrollment.transfer': 'Transferred',
      'enrollment.csv_import': 'CSV import',
    }),
    []
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="input w-72"
        >
          <option value="">All courses</option>
          {courses?.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : data && data.length > 0 ? (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-elevated/50 border-b border-border">
                <th className="px-4 py-2 text-left text-xs font-medium text-ink-muted uppercase">When</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-ink-muted uppercase">Action</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-ink-muted uppercase">Actor</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-ink-muted uppercase">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {data.map((entry, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2 text-xs text-ink-muted">{formatDateTime(entry.created_at)}</td>
                  <td className="px-4 py-2">
                    <span className="badge badge-blue text-[10px]">
                      {labelMap[entry.action] ?? entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-ink-secondary text-xs">{entry.actor_email ?? '—'}</td>
                  <td className="px-4 py-2 text-ink-secondary text-xs">{entry.summary ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card p-12 text-center text-ink-muted">
          <History className="h-10 w-10 mx-auto mb-3" /> No enrollment events recorded.
        </div>
      )}
    </div>
  )
}
