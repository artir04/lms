import type { Notification } from '@/types/notification'

const ICONS: Record<string, string> = {
  grade_posted: '📝',
  grade: '📝',
  deadline: '⏰',
  announcement: '📢',
  message: '💬',
  attendance: '📋',
  quiz: '📖',
  badge: '🏆',
}

const DEFAULT_ICON = '🔔'

export function notificationIcon(type: string): string {
  return ICONS[type] ?? DEFAULT_ICON
}

interface NotificationDisplay {
  title: string
  body: string | null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function humanizeType(type: string): string {
  const spaced = type.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function formatNotification(notif: Notification): NotificationDisplay {
  const payload = (notif.payload ?? {}) as Record<string, unknown>

  switch (notif.type) {
    case 'grade_posted': {
      const grade = asString(payload.grade)
      const category = asString(payload.category)
      const label = asString(payload.label)
      const title = grade ? `Grade posted: ${grade}` : 'Grade posted'
      const bodyParts = [category, label].filter((part): part is string => part !== null)
      return { title, body: bodyParts.length ? bodyParts.join(' — ') : null }
    }

    case 'deadline': {
      const course = asString(payload.course)
      const message = asString(payload.message) ?? 'Upcoming deadline'
      return { title: course ?? 'Deadline reminder', body: message }
    }

    case 'announcement': {
      const message = asString(payload.message)
      return { title: 'Announcement', body: message }
    }

    default: {
      const title = asString(payload.title) ?? humanizeType(notif.type)
      const body = asString(payload.body) ?? asString(payload.message)
      return { title, body }
    }
  }
}
