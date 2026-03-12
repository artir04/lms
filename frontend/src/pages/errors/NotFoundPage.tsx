import { Link } from 'react-router-dom'
import { ROUTES } from '@/config/routes'

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-8xl font-bold text-gray-200">404</h1>
        <h2 className="text-2xl font-bold text-gray-900 mt-4">Page not found</h2>
        <p className="text-gray-500 mt-2">The page you're looking for doesn't exist.</p>
        <Link to={ROUTES.DASHBOARD} className="btn-primary mt-6 inline-flex">Back to Dashboard</Link>
      </div>
    </div>
  )
}

export function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-8xl font-bold text-gray-200">403</h1>
        <h2 className="text-2xl font-bold text-gray-900 mt-4">Access Denied</h2>
        <p className="text-gray-500 mt-2">You don't have permission to view this page.</p>
        <Link to={ROUTES.DASHBOARD} className="btn-primary mt-6 inline-flex">Back to Dashboard</Link>
      </div>
    </div>
  )
}
