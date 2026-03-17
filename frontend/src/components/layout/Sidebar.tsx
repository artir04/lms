import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  MessageSquare,
  BarChart3,
  Users,
  Settings,
  LogOut,
  X,
  BookMarked,
  ChevronRight,
  Calendar,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Avatar } from '@/components/ui/Avatar'
import { ROUTES } from '@/config/routes'

interface SidebarProps {
  onClose?: () => void
}

interface NavSection {
  label: string
  items: {
    to: string
    icon: React.ElementType
    label: string
    end?: boolean
  }[]
}

export function Sidebar({ onClose }: SidebarProps) {
  const { user, isStudent, isTeacher, isAdmin, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navSections: NavSection[] = [
    {
      label: 'Main',
      items: [
        { to: ROUTES.DASHBOARD, icon: LayoutDashboard, label: 'Dashboard', end: true },
        { to: ROUTES.COURSES, icon: BookOpen, label: 'Courses' },
      ],
    },
    {
      label: 'Learning',
      items: [
        ...(isStudent
          ? [
              { to: ROUTES.MY_GRADES, icon: GraduationCap, label: 'My Grades' },
              { to: ROUTES.ATTENDANCE, icon: Calendar, label: 'My Attendance' },
            ]
          : []),
        { to: ROUTES.MESSAGING, icon: MessageSquare, label: 'Messages' },
        ...(isTeacher || isAdmin
          ? [{ to: ROUTES.ANALYTICS, icon: BarChart3, label: 'Analytics' }]
          : []),
      ],
    },
    ...(isAdmin
      ? [
          {
            label: 'Administration',
            items: [
              { to: ROUTES.ADMIN_USERS, icon: Users, label: 'Users' },
              { to: ROUTES.ADMIN_SETTINGS, icon: Settings, label: 'Settings' },
            ],
          },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col h-full sidebar-scroll overflow-y-auto">
      {/* Brand */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary-600 flex items-center justify-center shadow-lg shadow-primary-900/50">
            <BookMarked className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-base tracking-tight">EduDitari</span>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
        {navSections.map((section) =>
          section.items.length === 0 ? null : (
            <div key={section.label}>
              <p className="nav-section">{section.label}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        isActive ? 'nav-item-active' : 'nav-item'
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon className="w-[18px] h-[18px] shrink-0" />
                          <span className="flex-1">{item.label}</span>
                          {isActive && (
                            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                          )}
                        </>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          )
        )}
      </nav>

      {/* User profile */}
      {user && (
        <div className="shrink-0 p-3 border-t border-white/5">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group">
            <Avatar src={user.avatar_url} name={user.full_name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate leading-tight">
                {user.full_name}
              </p>
              <p className="text-xs text-slate-500 capitalize leading-tight mt-0.5">
                {user.roles[0]}
              </p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
