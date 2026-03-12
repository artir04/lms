import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import {
  BookMarked,
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
    login(data, { onSuccess: () => navigate(ROUTES.DASHBOARD) })
  }

  const apiError = (error as any)?.response?.data?.detail

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ───────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[45%] xl:w-1/2 flex-col relative overflow-hidden p-12"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
        }}
      >
        {/* Decorative blobs */}
        <div className="absolute -top-48 -right-48 w-96 h-96 rounded-full bg-primary-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-48 -left-48 w-96 h-96 rounded-full bg-purple-500/15 blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center shadow-lg shadow-primary-900/50">
            <BookMarked className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-xl">EduDitari</span>
        </div>

        {/* Hero text */}
        <div className="relative mt-auto mb-10">
          <p className="text-primary-400 text-sm font-medium mb-2">Modern Learning Platform</p>
          <h2 className="text-4xl font-bold text-white leading-tight">
            Empower every <br />
            <span className="text-primary-300">learner's journey</span>
          </h2>
          <p className="mt-4 text-slate-400 text-base leading-relaxed max-w-sm">
            A complete LMS for students, teachers, and administrators to learn, grow, and succeed together.
          </p>
        </div>

        {/* Feature grid */}
        <div className="relative grid grid-cols-2 gap-3">
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="flex items-start gap-3 p-3.5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm"
            >
              <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-primary-400" />
              </div>
              <div>
                <p className="text-white text-sm font-medium leading-tight">{label}</p>
                <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ──────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 bg-slate-900">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center">
            <BookMarked className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-xl text-white">EduDitari</span>
        </div>

        <div className="w-full max-w-[380px]">
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-white">Welcome back</h1>
            <p className="mt-1 text-slate-500 text-sm">Sign in to your account to continue</p>
          </div>

          {apiError && (
            <div className="mb-5 flex items-start gap-2.5 text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 text-sm">
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
                className={errors.tenant_slug ? 'input-error' : 'input'}
                autoComplete="organization"
              />
              {errors.tenant_slug && (
                <p className="mt-1.5 text-xs text-rose-600">{errors.tenant_slug.message}</p>
              )}
            </div>

            <div>
              <label className="label">Email address</label>
              <input
                {...register('email')}
                type="email"
                placeholder="you@school.edu"
                className={errors.email ? 'input-error' : 'input'}
                autoComplete="email"
              />
              {errors.email && (
                <p className="mt-1.5 text-xs text-rose-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={cn(errors.password ? 'input-error' : 'input', 'pr-10')}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-rose-600">{errors.password.message}</p>
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

          <div className="mt-6 p-3.5 rounded-xl bg-slate-800 border border-slate-700">
            <p className="text-xs font-medium text-slate-400 mb-1.5">Demo credentials</p>
            <p className="text-xs text-slate-400 font-mono">org: lincoln-unified</p>
            <p className="text-xs text-slate-400 font-mono">admin@lincoln-unified.edu / Admin123!</p>
          </div>
        </div>
      </div>
    </div>
  )
}
