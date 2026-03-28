import { Bell, LogOut, Menu, Search, Check } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useNotificationStore } from '@/store/notificationStore'
import { useNotifications, useMarkNotificationsRead } from '@/api/notifications'
import { Avatar } from '@/components/ui/Avatar'
import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { timeAgo } from '@/utils/formatters'

interface TopbarProps {
  title?: string
  onMenuClick?: () => void
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/courses': 'Courses',
  '/grades': 'My Grades',
  '/analytics': 'Analytics',
  '/gamification': 'Achievements',
  '/parent': 'Parent Dashboard',
  '/admin/users': 'User Management',
  '/admin/reports': 'Reports',
  '/admin/settings': 'Settings',
  '/attendance': 'My Attendance',
}

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.includes('/gradebook')) return 'Gradebook'
  if (pathname.includes('/lessons/')) return 'Lesson'
  if (pathname.includes('/build')) return 'Quiz Builder'
  if (pathname.includes('/take')) return 'Take Quiz'
  if (pathname.includes('/edit')) return 'Edit Course'
  if (pathname.includes('/attendance/report')) return 'Attendance Report'
  if (pathname.includes('/attendance')) return 'Mark Attendance'
  if (pathname.match(/\/courses\/[^/]+$/)) return 'Course Details'
  return 'EduDitari'
}

const NOTIFICATION_ICONS: Record<string, string> = {
  grade: '📝',
  attendance: '📋',
  quiz: '📖',
  badge: '🏆',
  system: '🔔',
}

export function Topbar({ title, onMenuClick }: TopbarProps) {
  const { user, logout } = useAuth()
  const { unreadCount } = useNotificationStore()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  const { data: notifData } = useNotifications(1, 8)
  const { mutate: markRead } = useMarkNotificationsRead()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleMarkAllRead = () => {
    if (!notifData?.items.length) return
    const unreadIds = notifData.items.filter((n) => !n.is_read).map((n) => n.id)
    if (unreadIds.length) markRead(unreadIds)
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false)
      }
    }
    if (bellOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [bellOpen])

  const pageTitle = title || getPageTitle(pathname)

  return (
    <header className="h-14 bg-surface border-b border-border shadow-topbar flex items-center gap-3 px-4 sm:px-6 shrink-0 z-10">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-xl text-ink-secondary hover:text-ink hover:bg-surface-elevated transition-colors"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <h1 className="text-sm font-semibold text-ink hidden sm:block tracking-tight font-display">
        {pageTitle}
      </h1>

      <div className="flex-1" />

      <button className="hidden md:flex items-center gap-2.5 bg-surface-elevated hover:bg-surface-overlay border border-border rounded-xl px-3.5 py-2 text-sm text-ink-muted w-52 transition-colors">
        <Search className="w-3.5 h-3.5 shrink-0" />
        <span>Search...</span>
        <kbd className="ml-auto text-[10px] bg-surface-overlay text-ink-muted px-1.5 py-0.5 rounded font-mono hidden lg:block">
          ⌘K
        </kbd>
      </button>

      {/* Notification bell with dropdown */}
      <div ref={bellRef} className="relative">
        <button
          onClick={() => setBellOpen(!bellOpen)}
          className="relative p-2 rounded-xl text-ink-secondary hover:text-ink hover:bg-surface-elevated transition-colors"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-500 rounded-full ring-2 ring-surface animate-pulse-glow" />
          )}
        </button>

        {bellOpen && (
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface-elevated rounded-2xl shadow-card-hover border border-border-strong z-30 overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-ink font-display">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 font-medium"
                >
                  <Check className="w-3 h-3" /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto custom-scroll">
              {!notifData?.items.length ? (
                <div className="px-4 py-8 text-center text-sm text-ink-muted">
                  No notifications yet
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {notifData.items.map((n) => (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                        n.is_read ? '' : 'bg-primary-500/[0.06]'
                      }`}
                    >
                      <span className="text-lg shrink-0 mt-0.5">
                        {NOTIFICATION_ICONS[n.type] || NOTIFICATION_ICONS.system}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-tight ${n.is_read ? 'text-ink-secondary' : 'text-ink'}`}>
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="text-xs text-ink-muted mt-0.5 truncate">{n.body}</p>
                        )}
                        <p className="text-[10px] text-ink-faint mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                      {!n.is_read && (
                        <span className="w-2 h-2 bg-primary-500 rounded-full shrink-0 mt-1.5" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 p-1 rounded-xl hover:bg-surface-elevated transition-colors"
        >
          {user && <Avatar src={user.avatar_url} name={user.full_name} size="sm" />}
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 mt-2 w-56 bg-surface-elevated rounded-2xl shadow-card-hover border border-border-strong z-20 py-1.5 animate-scale-in">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-semibold text-ink font-display">{user?.full_name}</p>
                <p className="text-xs text-ink-secondary mt-0.5">{user?.email}</p>
                <span className="badge badge-yellow mt-2 capitalize">
                  {user?.roles[0]}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors mt-1"
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
