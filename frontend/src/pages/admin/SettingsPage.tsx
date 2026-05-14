import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Settings, School, Save, CheckCircle2, AlertCircle } from 'lucide-react'
import { useTenantSettings, useUpdateTenantSettings } from '@/api/tenants'
import { PageLoader } from '@/components/ui/Spinner'
import { cn } from '@/utils/cn'

type Tab = 'general' | 'security'

interface GeneralSettingsValues {
  platform_name: string
  support_email: string
  timezone: string
  academic_year: string
  grading_system: string
}

interface SecuritySettingsValues {
  session_timeout_min: number
  max_login_attempts: number
  password_min_length: number
  require_uppercase: boolean
  require_numbers: boolean
}

const GENERAL_DEFAULTS: GeneralSettingsValues = {
  platform_name: 'EduDitari',
  support_email: '',
  timezone: 'Europe/Belgrade',
  academic_year: '2025-2026',
  grading_system: 'kosovo_1_5',
}

const SECURITY_DEFAULTS: SecuritySettingsValues = {
  session_timeout_min: 15,
  max_login_attempts: 5,
  password_min_length: 8,
  require_uppercase: true,
  require_numbers: true,
}

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('general')
  const { data: settings, isLoading } = useTenantSettings()

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'general', label: 'General', icon: School },
    { key: 'security', label: 'Security', icon: Settings },
  ]

  if (isLoading) return <PageLoader />

  const general = { ...GENERAL_DEFAULTS, ...((settings?.general as Partial<GeneralSettingsValues>) ?? {}) }
  const security = { ...SECURITY_DEFAULTS, ...((settings?.security as Partial<SecuritySettingsValues>) ?? {}) }

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

      {tab === 'general' && <GeneralSettings initial={general} />}
      {tab === 'security' && <SecuritySettings initial={security} />}
    </div>
  )
}

function GeneralSettings({ initial }: { initial: GeneralSettingsValues }) {
  const [saved, setSaved] = useState(false)
  const { mutate, isPending, error } = useUpdateTenantSettings()
  const form = useForm<GeneralSettingsValues>({ defaultValues: initial })

  useEffect(() => {
    form.reset(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initial)])

  const onSubmit = form.handleSubmit((values) =>
    mutate(
      { general: values },
      {
        onSuccess: () => {
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        },
      }
    )
  )

  const apiError = (error as any)?.response?.data?.detail

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

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={isPending} className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" /> {isPending ? 'Saving...' : 'Save Settings'}
        </button>
        {saved && (
          <span className="text-sm text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Saved
          </span>
        )}
        {apiError && (
          <span className="text-sm text-red-400 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" /> {typeof apiError === 'string' ? apiError : 'Save failed'}
          </span>
        )}
      </div>
    </form>
  )
}

function SecuritySettings({ initial }: { initial: SecuritySettingsValues }) {
  const [saved, setSaved] = useState(false)
  const { mutate, isPending, error } = useUpdateTenantSettings()
  const form = useForm<SecuritySettingsValues>({ defaultValues: initial })

  useEffect(() => {
    form.reset(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initial)])

  const onSubmit = form.handleSubmit((values) =>
    mutate(
      { security: values },
      {
        onSuccess: () => {
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        },
      }
    )
  )

  const apiError = (error as any)?.response?.data?.detail

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
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={isPending} className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" /> {isPending ? 'Saving...' : 'Save Security Settings'}
        </button>
        {saved && (
          <span className="text-sm text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Saved
          </span>
        )}
        {apiError && (
          <span className="text-sm text-red-400 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" /> {typeof apiError === 'string' ? apiError : 'Save failed'}
          </span>
        )}
      </div>
    </form>
  )
}
