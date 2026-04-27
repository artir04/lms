import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Search, BookOpen } from 'lucide-react'
import { useTeacherStudents } from '@/api/teacher'
import { Avatar } from '@/components/ui/Avatar'
import { PageLoader } from '@/components/ui/Spinner'
import { ROUTES } from '@/config/routes'

export function MyStudentsPage() {
  const { data, isLoading } = useTeacherStudents()
  const [search, setSearch] = useState('')
  const [courseFilter, setCourseFilter] = useState<string>('')

  const courseOptions = useMemo(() => {
    const map = new Map<string, string>()
    data?.forEach((s) => s.courses.forEach((c) => map.set(c.id, c.title)))
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data.filter((s) => {
      const matchesSearch =
        !q ||
        s.full_name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      const matchesCourse =
        !courseFilter || s.courses.some((c) => c.id === courseFilter)
      return matchesSearch && matchesCourse
    })
  }, [data, search, courseFilter])

  if (isLoading || !data) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-ink font-display">My Students</h2>
          <p className="text-sm text-ink-muted mt-1">
            <Users className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
            {data.length} unique student{data.length === 1 ? '' : 's'} across your courses
          </p>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="input pl-9"
          />
        </div>
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="input w-auto min-w-[200px]"
        >
          <option value="">All courses</option>
          {courseOptions.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-ink-muted text-sm">
            {data.length === 0 ? "You don't have any students yet." : 'No matches.'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar src={s.avatar_url} name={s.full_name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{s.full_name}</p>
                    <p className="text-xs text-ink-muted truncate">{s.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end shrink-0 max-w-[60%]">
                  <span className="text-xs text-ink-muted flex items-center gap-1 mr-1">
                    <BookOpen className="w-3 h-3" /> {s.course_count}
                  </span>
                  {s.courses.map((c) => (
                    <Link
                      key={c.id}
                      to={ROUTES.COURSE_DETAIL(c.id)}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-surface-elevated text-ink-secondary hover:bg-primary-500/15 hover:text-primary-300 transition-colors uppercase tracking-wider"
                    >
                      {c.title}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
