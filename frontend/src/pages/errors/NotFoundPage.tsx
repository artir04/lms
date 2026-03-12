import { Link } from 'react-router-dom'
import { ROUTES } from '@/config/routes'
import { BookMarked, ArrowLeft, ShieldOff } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center mx-auto mb-6">
          <BookMarked className="w-8 h-8 text-primary-600" />
        </div>
        <h1 className="text-7xl font-black text-slate-200 select-none">404</h1>
        <h2 className="text-xl font-bold text-white mt-2">Page not found</h2>
        <p className="text-slate-500 mt-2 text-sm">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to={ROUTES.DASHBOARD} className="btn-primary mt-6 inline-flex">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}

export function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center mx-auto mb-6">
          <ShieldOff className="w-8 h-8 text-rose-600" />
        </div>
        <h1 className="text-7xl font-black text-slate-200 select-none">403</h1>
        <h2 className="text-xl font-bold text-white mt-2">Access Denied</h2>
        <p className="text-slate-500 mt-2 text-sm">
          You don't have permission to view this page.
        </p>
        <Link to={ROUTES.DASHBOARD} className="btn-primary mt-6 inline-flex">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
