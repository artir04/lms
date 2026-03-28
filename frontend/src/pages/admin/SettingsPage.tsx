import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Settings, Shield, School, Users, Save, CheckCircle2 } from 'lucide-react'
import api from '@/config/axios'
import { PageLoader } from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/utils/cn'

interface TenantSettings {
  id: string
  name: string
  slug: string
  settings: Record<string, any>
}

type Tab = 'general' | 'roles' | 'security'

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('general')
  const { isSuperAdmin } = useAuth()
  const qc = useQueryClient()

  const { data: tenants, isLoading } = useQuery<TenantSettings[]>({
    queryKey: ['tenants'],
    queryFn: () => api.get('/tenants').then((r) => r.data),
    enabled: isSuperAdmin,
  })

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'general', label: 'General', icon: School },
    { key: 'roles', label: 'Roles & Permissions', icon: Shield },
    { key: 'security', label: 'Security', icon: Settings },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-ink font-display">Platform Settings</h2>

      <div className="flex gap-2 border-b border-border pb-px">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              tab === t.key
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-ink-muted hover:text-ink-secondary'
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && <GeneralSettings />}
      {tab === 'roles' && <RolesSettings />}
      {tab === 'security' && <SecuritySettings />}
    </div>
  )
}

function GeneralSettings() {
  const [saved, setSaved] = useState(false)
  const form = useForm({
    defaultValues: {
      platform_name: 'EduDitari',
      support_email: '',
      timezone: 'Europe/Belgrade',
      academic_year: '2025-2026',
      grading_system: 'kosovo_1_5',
      allow_student_enrollment: false,
    },
  })

  const onSubmit = form.handleSubmit(() => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  })

  return (
    <form onSubmit={onSubmit} className="card p-6 max-w-2xl space-y-5">
      <h3 className="text-lg font-semibold text-ink flex items-center gap-2 font-display">
        <School className="w-5 h-5 text-primary-400" /> General Configuration
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Platform Name</label>
          <input {...form.register('platform_name')} className="input" />
        </div>
        <div>
          <label className="label">Support Email</label>
          <input {...form.register('support_email')} type="email" className="input" placeholder="admin@school.edu" />
        </div>
        <div>
          <label className="label">Timezone</label>
          <select {...form.register('timezone')} className="input">
            <option value="Europe/Belgrade">Europe/Belgrade (CET)</option>
            <option value="Europe/London">Europe/London (GMT)</option>
            <option value="America/New_York">America/New York (EST)</option>
            <option value="America/Chicago">America/Chicago (CST)</option>
          </select>
        </div>
        <div>
          <label className="label">Academic Year</label>
          <input {...form.register('academic_year')} className="input" />
        </div>
      </div>

      <div>
        <label className="label">Grading System</label>
        <select {...form.register('grading_system')} className="input max-w-xs">
          <option value="kosovo_1_5">Kosovo (1-5 Numeric)</option>
          <option value="letter_a_f">Letter Grades (A-F)</option>
          <option value="percentage">Percentage (0-100%)</option>
        </select>
      </div>

      <div className="flex items-center gap-3">
        <input type="checkbox" id="allow_enrollment" {...form.register('allow_student_enrollment')} className="rounded" />
        <label htmlFor="allow_enrollment" className="text-sm text-ink-secondary">
          Allow students to self-enroll in courses
        </label>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" /> Save Settings
        </button>
        {saved && (
          <span className="text-sm text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Saved
          </span>
        )}
      </div>
    </form>
  )
}

function RolesSettings() {
  const roles = [
    {
      name: 'Superadmin',
      description: 'Full platform control. Manages districts, schools, and all system settings.',
      permissions: ['All permissions'],
      color: 'text-rose-400 bg-rose-500/10',
    },
    {
      name: 'Admin',
      description: 'School-level management. Manages users, courses, and generates reports.',
      permissions: ['User management', 'Course management', 'Reports', 'Attendance oversight', 'Grade oversight'],
      color: 'text-amber-400 bg-amber-500/10',
    },
    {
      name: 'Teacher',
      description: 'Creates and manages courses, quizzes, grades, and attendance for assigned classes.',
      permissions: ['Create courses', 'Create quizzes', 'Grade students', 'Mark attendance', 'View analytics', 'Message students'],
      color: 'text-sky-400 bg-sky-500/10',
    },
    {
      name: 'Parent',
      description: 'View-only access to linked children\'s progress, attendance, and grades.',
      permissions: ['View child progress', 'View child grades', 'View child attendance', 'View upcoming assignments'],
      color: 'text-purple-400 bg-purple-500/10',
    },
    {
      name: 'Student',
      description: 'Access courses, take quizzes, view grades, and participate in gamification.',
      permissions: ['View courses', 'Take quizzes', 'View grades', 'View attendance', 'Earn badges & points', 'Message teachers'],
      color: 'text-emerald-400 bg-emerald-500/10',
    },
  ]

  return (
    <div className="space-y-4 max-w-3xl">
      <h3 className="text-lg font-semibold text-ink flex items-center gap-2 font-display">
        <Shield className="w-5 h-5 text-primary-400" /> Role-Based Access Control
      </h3>
      <p className="text-sm text-ink-muted">
        The platform uses a 5-tier role hierarchy. Each role inherits access from the roles below it.
      </p>

      <div className="space-y-3">
        {roles.map((role) => (
          <div key={role.name} className="card p-5">
            <div className="flex items-start gap-4">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', role.color)}>
                <Users className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-ink">{role.name}</h4>
                <p className="text-xs text-ink-muted mt-0.5">{role.description}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {role.permissions.map((p) => (
                    <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-ink-faint/60 text-ink-secondary">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SecuritySettings() {
  const [saved, setSaved] = useState(false)
  const form = useForm({
    defaultValues: {
      session_timeout_min: 15,
      max_login_attempts: 5,
      password_min_length: 8,
      require_uppercase: true,
      require_numbers: true,
      enable_2fa: false,
    },
  })

  const onSubmit = form.handleSubmit(() => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  })

  return (
    <form onSubmit={onSubmit} className="card p-6 max-w-2xl space-y-5">
      <h3 className="text-lg font-semibold text-ink flex items-center gap-2 font-display">
        <Settings className="w-5 h-5 text-primary-400" /> Security Configuration
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Session Timeout (minutes)</label>
          <input {...form.register('session_timeout_min', { valueAsNumber: true })} type="number" min={5} max={120} className="input" />
        </div>
        <div>
          <label className="label">Max Login Attempts</label>
          <input {...form.register('max_login_attempts', { valueAsNumber: true })} type="number" min={3} max={20} className="input" />
        </div>
        <div>
          <label className="label">Password Min Length</label>
          <input {...form.register('password_min_length', { valueAsNumber: true })} type="number" min={6} max={32} className="input" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input type="checkbox" id="req_upper" {...form.register('require_uppercase')} className="rounded" />
          <label htmlFor="req_upper" className="text-sm text-ink-secondary">Require uppercase letters in passwords</label>
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="req_nums" {...form.register('require_numbers')} className="rounded" />
          <label htmlFor="req_nums" className="text-sm text-ink-secondary">Require numbers in passwords</label>
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="enable_2fa" {...form.register('enable_2fa')} className="rounded" />
          <label htmlFor="enable_2fa" className="text-sm text-ink-secondary">Enable two-factor authentication (2FA)</label>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" /> Save Security Settings
        </button>
        {saved && (
          <span className="text-sm text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Saved
          </span>
        )}
      </div>
    </form>
  )
}
