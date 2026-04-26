import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { Sparkles, AlertCircle, ArrowRight, ArrowLeft, MailCheck } from 'lucide-react'
import { useForgotPassword } from '@/api/auth'
import { ROUTES } from '@/config/routes'

const schema = z.object({
  tenant_slug: z.string().min(1, 'Organization is required'),
  email: z.string().email('Enter a valid email'),
})

type FormData = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const { mutate, isPending, isSuccess, error } = useForgotPassword()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = (data: FormData) => mutate(data)

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
            <h1 className="text-2xl font-bold text-ink font-display">Forgot password?</h1>
            <p className="mt-1 text-ink-secondary text-sm">
              Enter your organization and email and we'll send a reset link.
            </p>
          </div>

          {isSuccess ? (
            <div className="flex items-start gap-3 text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-4 text-sm">
              <MailCheck className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Check your inbox</p>
                <p className="mt-1 text-emerald-300/80">
                  If an account exists for that email, a reset link has been sent. The link
                  expires in 1 hour.
                </p>
              </div>
            </div>
          ) : (
            <>
              {apiError && (
                <div className="mb-5 flex items-start gap-2.5 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{typeof apiError === 'string' ? apiError : 'Something went wrong.'}</span>
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
                    <p className="mt-1.5 text-xs text-red-400">{errors.tenant_slug.message}</p>
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
                    <p className="mt-1.5 text-xs text-red-400">{errors.email.message}</p>
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
                      Sending...
                    </span>
                  ) : (
                    <>
                      Send reset link
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
