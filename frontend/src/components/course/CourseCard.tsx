import { Link } from 'react-router-dom'
import { ChevronRight, Users } from 'lucide-react'
import type { Course } from '@/types/course'
import { ROUTES } from '@/config/routes'
import { cn } from '@/utils/cn'

interface CourseCardProps {
  course: Course
}

const GRADIENTS = [
  'from-violet-500 to-indigo-600',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-500',
  'from-rose-500 to-pink-600',
  'from-purple-500 to-violet-600',
  'from-cyan-500 to-sky-600',
  'from-lime-500 to-emerald-600',
]

function getGradient(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % GRADIENTS.length
  return GRADIENTS[Math.abs(hash)]
}

export function CourseCard({ course }: CourseCardProps) {
  const gradient = getGradient(course.id)
  const initials = course.title.substring(0, 2).toUpperCase()

  return (
    <Link
      to={ROUTES.COURSE_DETAIL(course.id)}
      className="card-hover block group"
    >
      {/* Gradient banner */}
      <div
        className={cn(
          'h-24 bg-gradient-to-br flex items-end p-3 relative overflow-hidden',
          gradient
        )}
      >
        <span className="absolute inset-0 flex items-center justify-center text-white/10 text-7xl font-black select-none leading-none">
          {initials}
        </span>
        <span
          className={cn(
            'relative badge text-white ring-0 text-[10px]',
            course.is_published
              ? 'bg-white/20 backdrop-blur-sm'
              : 'bg-black/20 backdrop-blur-sm'
          )}
        >
          {course.is_published ? 'Published' : 'Draft'}
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2 group-hover:text-primary-600 transition-colors">
          {course.title}
        </h3>
        {course.description && (
          <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {course.description}
          </p>
        )}

        <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <Users className="w-3 h-3" />
            {course.teacher?.full_name?.split(' ')[0] ?? 'Instructor'}
          </span>
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary-500 transition-colors" />
        </div>
      </div>
    </Link>
  )
}
