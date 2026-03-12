import { Bell, LogOut, Menu, Search } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useNotificationStore } from '@/store/notificationStore'
import { Avatar } from '@/components/ui/Avatar'
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

interface TopbarProps {
  title?: string
  onMenuClick?: () => void
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/courses': 'Courses',
  '/grades': 'My Grades',
  '/messaging': 'Messages',
  '/analytics': 'Analytics',
  '/admin/users': 'User Management',
  '/admin/settings': 'Settings',
}

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.includes('/gradebook')) return 'Gradebook'
  if (pathname.includes('/lessons/')) return 'Lesson'
  if (pathname.includes('/build')) return 'Quiz Builder'
  if (pathname.includes('/take')) return 'Take Quiz'
  if (pathname.includes('/edit')) return 'Edit Course'
  if (pathname.match(/\/courses\/[^/]+$/)) return 'Course Details'
  return 'EduFlow'
}

export function Topbar({ title, onMenuClick }: TopbarProps) {
  const { user, logout } = useAuth()
  const { unreadCount } = useNotificationStore()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const pageTitle = title || getPageTitle(pathname)

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-700/60 flex items-center gap-3 px-4 sm:px-6 shrink-0 z-10">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <h1 className="text-sm font-semibold text-slate-100 hidden sm:block tracking-tight">{pageTitle}</h1>

      <div className="flex-1" />

      <button className="hidden md:flex items-center gap-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-500 w-52 transition-colors">
        <Search className="w-3.5 h-3.5 shrink-0" />
        <span>Search...</span>
        <kbd className="ml-auto text-[10px] bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded font-mono hidden lg:block">
          ⌘K
        </kbd>
      </button>

      <button className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-slate-900" />
        )}
      </button>

      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-800 transition-colors"
        >
          {user && <Avatar src={user.avatar_url} name={user.full_name} size="sm" />}
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 mt-2 w-56 bg-slate-800 rounded-2xl shadow-xl border border-slate-700 z-20 py-1.5 animate-scale-in">
              <div className="px-4 py-3 border-b border-slate-700">
                <p className="text-sm font-semibold text-white">{user?.full_name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>
                <span className="badge badge-indigo mt-2 capitalize">
                  {user?.roles[0]}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-900/30 hover:text-rose-300 transition-colors mt-1"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
