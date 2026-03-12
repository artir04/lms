import { NavLink } from 'react-router-dom'
import { BookOpen, LayoutDashboard, MessageSquare, BarChart2, Users, Settings, GraduationCap, FileText, Bell } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAuth } from '@/hooks/useAuth'
import { Avatar } from '@/components/ui/Avatar'
import { ROUTES } from '@/config/routes'

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
}

export function Sidebar() {
  const { user, isStudent, isTeacher, isAdmin } = useAuth()

  const navItems: NavItem[] = [
    { to: ROUTES.DASHBOARD, icon: <LayoutDashboard className="h-5 w-5" />, label: 'Dashboard' },
    { to: ROUTES.COURSES, icon: <BookOpen className="h-5 w-5" />, label: 'Courses' },
    ...(isStudent ? [{ to: ROUTES.MY_GRADES, icon: <GraduationCap className="h-5 w-5" />, label: 'My Grades' }] : []),
    ...(isTeacher ? [{ to: ROUTES.ANALYTICS, icon: <BarChart2 className="h-5 w-5" />, label: 'Analytics' }] : []),
    { to: ROUTES.MESSAGING, icon: <MessageSquare className="h-5 w-5" />, label: 'Messages' },
    ...(isAdmin ? [
      { to: ROUTES.ADMIN_USERS, icon: <Users className="h-5 w-5" />, label: 'Users' },
      { to: ROUTES.ADMIN_SETTINGS, icon: <Settings className="h-5 w-5" />, label: 'Settings' },
    ] : []),
  ]

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
        <div className="bg-primary-600 text-white p-2 rounded-lg">
          <BookOpen className="h-5 w-5" />
        </div>
        <span className="text-lg font-bold text-gray-900">LMS Platform</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      {user && (
        <div className="px-4 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar src={user.avatar_url} name={user.full_name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user.full_name}</p>
              <p className="text-xs text-gray-500 truncate capitalize">{user.roles[0]}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
