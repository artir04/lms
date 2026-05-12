import { Link } from 'react-router-dom'
import { ROUTES } from '@/config/routes'
import { useAuth } from '@/hooks/useAuth'
import { BookMarked, ArrowLeft, ShieldOff } from 'lucide-react'

export function NotFoundPage() {
  const { isParent } = useAuth()
  const homeRoute = isParent ? ROUTES.PARENT : ROUTES.DASHBOARD
  const homeLabel = isParent ? 'Back to Parent Dashboard' : 'Back to Dashboard'

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-primary-500/15 flex items-center justify-center mx-auto mb-6">
          <BookMarked className="w-8 h-8 text-primary-400" />
        </div>
        <h1 className="text-7xl font-black text-ink select-none font-display">404</h1>
        <h2 className="text-xl font-bold text-ink mt-2 font-display">Page not found</h2>
        <p className="text-ink-muted mt-2 text-sm">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to={homeRoute} className="btn-primary mt-6 inline-flex">
          <ArrowLeft className="w-4 h-4" />
          {homeLabel}
        </Link>
      </div>
    </div>
  )
}

export function ForbiddenPage() {
  const { isParent } = useAuth()
  const homeRoute = isParent ? ROUTES.PARENT : ROUTES.DASHBOARD
  const homeLabel = isParent ? 'Back to Parent Dashboard' : 'Back to Dashboard'

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/15 flex items-center justify-center mx-auto mb-6">
          <ShieldOff className="w-8 h-8 text-rose-400" />
        </div>
        <h1 className="text-7xl font-black text-ink select-none font-display">403</h1>
        <h2 className="text-xl font-bold text-ink mt-2 font-display">Access Denied</h2>
        <p className="text-ink-muted mt-2 text-sm">
          You don't have permission to view this page.
        </p>
        <Link to={homeRoute} className="btn-primary mt-6 inline-flex">
          <ArrowLeft className="w-4 h-4" />
          {homeLabel}
        </Link>
      </div>
    </div>
  )
}
