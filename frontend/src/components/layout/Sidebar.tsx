import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  BarChart3,
  Users,
  Settings,
  LogOut,
  X,
  ChevronRight,
  Calendar,
  Trophy,
  UserCheck,
  FileBarChart,
  Sparkles,
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
  const { user, isStudent, isParent, isTeacher, isAdmin, logout } = useAuth()
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
        ...(isParent
          ? [{ to: ROUTES.PARENT_DASHBOARD, icon: UserCheck, label: 'My Children' }]
          : []),
      ],
    },
    {
      label: 'Learning',
      items: [
        ...(isStudent
          ? [
              { to: ROUTES.MY_GRADES, icon: GraduationCap, label: 'My Grades' },
              { to: ROUTES.ATTENDANCE, icon: Calendar, label: 'My Attendance' },
              { to: ROUTES.GAMIFICATION, icon: Trophy, label: 'Achievements' },
            ]
          : []),
        ...(isTeacher || isAdmin
          ? [{ to: ROUTES.ANALYTICS, icon: BarChart3, label: 'Analytics' }]
          : []),
      ],
    },
    ...(isTeacher && !isAdmin
      ? [
          {
            label: 'Teaching',
            items: [
              { to: ROUTES.TEACHER_ATTENDANCE, icon: Calendar, label: 'Attendance' },
              { to: ROUTES.MY_STUDENTS, icon: Users, label: 'My Students' },
            ],
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            label: 'Administration',
            items: [
              { to: ROUTES.ADMIN_USERS, icon: Users, label: 'Users' },
              { to: ROUTES.ADMIN_REPORTS, icon: FileBarChart, label: 'Reports' },
              { to: ROUTES.ADMIN_SETTINGS, icon: Settings, label: 'Settings' },
            ],
          },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col h-full sidebar-scroll overflow-y-auto">
      {/* Brand */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-white/[0.04] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-900/40">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-sidebar-text-active font-bold text-[15px] tracking-tight font-display">
            EduDitari
          </span>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg text-sidebar-text hover:text-sidebar-text-active hover:bg-white/[0.06] transition-colors"
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
                            <ChevronRight className="w-3.5 h-3.5 opacity-50" />
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
        <div className="shrink-0 p-3 border-t border-white/[0.04]">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors group">
            <Avatar src={user.avatar_url} name={user.full_name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-text-active truncate leading-tight font-display">
                {user.full_name}
              </p>
              <p className="text-xs text-sidebar-text capitalize leading-tight mt-0.5">
                {user.roles[0]}
              </p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-1.5 rounded-lg text-sidebar-text hover:text-rose-400 hover:bg-white/[0.06] transition-all opacity-0 group-hover:opacity-100"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
