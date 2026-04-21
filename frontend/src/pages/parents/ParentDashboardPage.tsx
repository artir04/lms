import { Link } from 'react-router-dom'
import { useParentChildren } from '@/api/parents'
import { PageLoader } from '@/components/ui/Spinner'
import { Users, GraduationCap, Clock, ChevronRight } from 'lucide-react'
import { cn } from '@/utils/cn'
import { ROUTES } from '@/config/routes'

export function ParentDashboardPage() {
  const { data: children, isLoading } = useParentChildren()

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div
        className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #4338ca 100%)' }}
      >
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-primary-500/15 blur-3xl pointer-events-none" />
        <div className="relative">
          <p className="text-primary-300 text-xs font-medium uppercase tracking-wider">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h2 className="text-2xl font-bold mt-1">Parent Portal</h2>
          <p className="text-slate-400 mt-1 text-sm">
            Monitor your children's academic progress and attendance
          </p>
        </div>
      </div>

      {/* Children count */}
      {children && children.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-600/20 flex items-center justify-center">
                <Users className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Children</p>
                <p className="text-lg font-bold text-white">{children.length}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Active Students</p>
                <p className="text-lg font-bold text-white">
                  {children.filter((c) => c.last_login).length}
                </p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-600/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Primary Contact</p>
                <p className="text-lg font-bold text-white">
                  {children.filter((c) => c.is_primary_contact).length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Children list */}
      <div>
        <h3 className="section-title mb-4">My Children</h3>

        {!children || children.length === 0 ? (
          <div className="card p-12 text-center text-slate-500">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>No children linked to your account</p>
            <p className="text-sm mt-2">Please contact your school administrator to link your children</p>
          </div>
        ) : (
          <div className="space-y-3">
            {children.map((child) => (
              <Link
                key={child.student_id}
                to={ROUTES.PARENT_CHILD(child.student_id)}
                className="card block hover:border-primary-500/50 transition-all duration-200 group"
              >
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                      {child.student_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-semibold text-white group-hover:text-primary-400 transition-colors">
                        {child.student_name}
                      </h4>
                      <p className="text-sm text-slate-400">{child.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded-full capitalize">
                          {child.relationship}
                        </span>
                        {child.is_primary_contact && (
                          <span className="text-xs bg-primary-600/20 text-primary-400 px-2 py-0.5 rounded-full">
                            Primary Contact
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-primary-400 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}