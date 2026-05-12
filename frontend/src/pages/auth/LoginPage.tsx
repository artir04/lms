import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import {
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  GraduationCap,
  Users,
  BarChart3,
  BookOpen,
} from 'lucide-react'
import { useState } from 'react'
import { useLogin } from '@/api/auth'
import { ROUTES } from '@/config/routes'
import { cn } from '@/utils/cn'

const schema = z.object({
  tenant_slug: z.string().min(1, 'Organization is required'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type FormData = z.infer<typeof schema>

const FEATURES = [
  { icon: BookOpen,       label: 'Rich Course Content',  desc: 'Videos, documents & interactive lessons' },
  { icon: GraduationCap,  label: 'Smart Assessments',    desc: 'Quizzes with auto-grading & feedback' },
  { icon: Users,          label: 'Collaboration Tools',  desc: 'Messaging, groups & announcements' },
  { icon: BarChart3,      label: 'Learning Analytics',   desc: 'Track progress & identify gaps' },
]

export function LoginPage() {
  const navigate = useNavigate()
  const [showPw, setShowPw] = useState(false)
  const { mutate: login, isPending, error } = useLogin()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = (data: FormData) => {
    login(data, { onSuccess: () => navigate('/') })
  }

  const apiError = (error as any)?.response?.data?.detail

  return (
    <div className="min-h-screen flex bg-surface-base">
      {/* Left panel — editorial hero */}
      <div
        className="hidden lg:flex lg:w-[45%] xl:w-1/2 flex-col relative overflow-hidden p-12
          bg-[linear-gradient(155deg,#fdf8ec_0%,#fceedd_40%,#fbd9b8_100%)]
          dark:bg-[linear-gradient(145deg,#0b0d12_0%,#111318_40%,#1a0f05_100%)]"
      >
        {/* Atmospheric glows */}
        <div className="absolute -top-48 -right-48 w-[500px] h-[500px] rounded-full bg-primary-300/40 blur-[120px] pointer-events-none dark:bg-primary-500/[0.07]" />
        <div className="absolute -bottom-48 -left-48 w-[400px] h-[400px] rounded-full bg-rose-300/30 blur-[100px] pointer-events-none dark:bg-violet-500/[0.05]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-amber-200/30 blur-[150px] pointer-events-none dark:bg-primary-500/[0.03]" />

        {/* Editorial decorative grid (light only) */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.4] dark:opacity-0"
          style={{
            backgroundImage: 'radial-gradient(rgba(80,55,20,0.10) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
          }}
        />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-[0_8px_24px_-6px_rgba(232,125,26,0.55)] ring-1 ring-primary-700/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="leading-tight">
            <span className="block text-ink dark:text-white font-bold text-xl font-display tracking-tight">
              EduDitari
            </span>
            <span className="block text-[10px] uppercase tracking-[0.24em] text-ink-muted font-semibold mt-0.5">
              Learning · Suite
            </span>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative mt-auto mb-12">
          <p className="text-primary-700 dark:text-primary-400 text-xs font-bold mb-4 uppercase tracking-[0.22em] font-display flex items-center gap-2.5">
            <span className="inline-block w-8 h-px bg-primary-500/70" />
            Modern Learning Platform
          </p>
          <h2 className="text-[3.4rem] font-bold text-ink dark:text-white leading-[1.02] font-display tracking-tight">
            Empower every{' '}
            <span className="italic font-medium bg-gradient-to-br from-primary-600 via-orange-600 to-rose-600 dark:from-primary-300 dark:to-primary-500 bg-clip-text text-transparent">
              learner's
            </span>{' '}
            journey.
          </h2>
          <p className="mt-6 text-ink-secondary text-[15px] leading-relaxed max-w-md">
            A complete LMS for students, teachers, and administrators to learn, grow, and succeed together.
          </p>
        </div>

        {/* Feature grid */}
        <div className="relative grid grid-cols-2 gap-3">
          {FEATURES.map(({ icon: Icon, label, desc }, i) => (
            <div
              key={label}
              className="flex items-start gap-3 p-4 rounded-2xl border border-primary-900/[0.06] bg-white/40 backdrop-blur-md animate-fade-up
                dark:border-white/[0.04] dark:bg-white/[0.02]
                shadow-[0_1px_2px_rgba(80,55,20,0.04)] dark:shadow-none"
              style={{ animationDelay: `${i * 0.1}s`, animationFillMode: 'backwards' }}
            >
              <div className="w-9 h-9 rounded-xl bg-primary-100 ring-1 ring-primary-200/70 dark:bg-primary-500/15 dark:ring-0 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-primary-700 dark:text-primary-400" />
              </div>
              <div>
                <p className="text-ink dark:text-white text-sm font-semibold leading-tight">{label}</p>
                <p className="text-ink-secondary dark:text-ink-muted text-xs mt-1 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 bg-surface">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-xl text-ink font-display">EduDitari</span>
        </div>

        <div className="w-full max-w-[380px]">
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-ink font-display">Welcome back</h1>
            <p className="mt-1 text-ink-secondary text-sm">Sign in to your account to continue</p>
          </div>

          {apiError && (
            <div className="mb-5 flex items-start gap-2.5 text-red-700 bg-red-50 border border-red-200 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/20 rounded-xl px-4 py-3 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{typeof apiError === 'string' ? apiError : 'Invalid credentials. Please try again.'}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Organization</label>
              <input
                {...register('tenant_slug')}
                placeholder="lincoln-unified"
                className={errors.tenant_slug ? 'input input-error' : 'input'}
                autoComplete="organization"
              />
              {errors.tenant_slug && (
                <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.tenant_slug.message}</p>
              )}
            </div>

            <div>
              <label className="label">Email address</label>
              <input
                {...register('email')}
                type="email"
                placeholder="you@school.edu"
                className={errors.email ? 'input input-error' : 'input'}
                autoComplete="email"
              />
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="label">Password</label>
                <Link
                  to={ROUTES.FORGOT_PASSWORD}
                  className="text-xs font-medium text-primary-700 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={cn(errors.password ? 'input input-error' : 'input', 'pr-10')}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="btn-primary w-full py-2.5 text-sm mt-2"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Signing in...
                </span>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 p-4 rounded-xl bg-surface-elevated border border-border">
            <p className="text-xs font-semibold text-ink-secondary mb-2 uppercase tracking-wider">Demo credentials</p>
            <p className="text-xs text-ink-muted font-mono">org: lincoln-unified</p>
            <p className="text-xs text-ink-muted font-mono">admin@lincoln-unified.edu / Admin123!</p>
          </div>
        </div>
      </div>
    </div>
  )
}
