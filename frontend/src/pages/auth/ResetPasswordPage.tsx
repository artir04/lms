import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Sparkles, AlertCircle, ArrowRight, ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useResetPassword } from '@/api/auth'
import { ROUTES } from '@/config/routes'
import { cn } from '@/utils/cn'

const schema = z
  .object({
    new_password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    path: ['confirm_password'],
    message: 'Passwords do not match',
  })

type FormData = z.infer<typeof schema>

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const navigate = useNavigate()
  const [showPw, setShowPw] = useState(false)
  const { mutate, isPending, isSuccess, error } = useResetPassword()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = (data: FormData) => mutate({ token, new_password: data.new_password })

  useEffect(() => {
    if (!isSuccess) return
    const t = setTimeout(() => navigate(ROUTES.LOGIN), 2000)
    return () => clearTimeout(t)
  }, [isSuccess, navigate])

  const apiError = (error as any)?.response?.data?.detail

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-base p-6">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-xl text-ink font-display">EduDitari</span>
        </div>

        <div className="card p-7">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-ink font-display">Set a new password</h1>
            <p className="mt-1 text-ink-secondary text-sm">
              Enter a new password for your account.
            </p>
          </div>

          {!token && (
            <div className="mb-5 flex items-start gap-2.5 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Reset link is missing a token. Please request a new reset email.</span>
            </div>
          )}

          {isSuccess ? (
            <div className="flex items-start gap-3 text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-4 text-sm">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Password updated</p>
                <p className="mt-1 text-emerald-300/80">Redirecting you to sign in...</p>
              </div>
            </div>
          ) : (
            <>
              {apiError && (
                <div className="mb-5 flex items-start gap-2.5 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{typeof apiError === 'string' ? apiError : 'Reset failed.'}</span>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="label">New password</label>
                  <div className="relative">
                    <input
                      {...register('new_password')}
                      type={showPw ? 'text' : 'password'}
                      placeholder="••••••••"
                      className={cn(errors.new_password ? 'input input-error' : 'input', 'pr-10')}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary transition-colors"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.new_password && (
                    <p className="mt-1.5 text-xs text-red-400">{errors.new_password.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">Confirm password</label>
                  <input
                    {...register('confirm_password')}
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={errors.confirm_password ? 'input input-error' : 'input'}
                    autoComplete="new-password"
                  />
                  {errors.confirm_password && (
                    <p className="mt-1.5 text-xs text-red-400">
                      {errors.confirm_password.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isPending || !token}
                  className="btn-primary w-full py-2.5 text-sm mt-2"
                >
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Resetting...
                    </span>
                  ) : (
                    <>
                      Reset password
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          <div className="mt-6 text-center">
            <Link
              to={ROUTES.LOGIN}
              className="text-sm text-ink-muted hover:text-ink-secondary inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
