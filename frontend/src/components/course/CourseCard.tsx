import { BookOpen, Users, Calendar } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Course } from '@/types/course'
import { ROUTES } from '@/config/routes'
import { formatDate } from '@/utils/formatters'
import { cn } from '@/utils/cn'

interface CourseCardProps {
  course: Course
}

const subjectColors: Record<string, string> = {
  Math: 'bg-blue-100 text-blue-700',
  Science: 'bg-green-100 text-green-700',
  English: 'bg-purple-100 text-purple-700',
  History: 'bg-yellow-100 text-yellow-700',
}

export function CourseCard({ course }: CourseCardProps) {
  const colorClass = subjectColors[course.subject || ''] || 'bg-gray-100 text-gray-700'

  return (
    <Link to={ROUTES.COURSE_DETAIL(course.id)} className="card block hover:shadow-md transition-shadow group">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className={cn('p-2 rounded-lg', colorClass)}>
            <BookOpen className="h-5 w-5" />
          </div>
          <span className={cn('badge', course.is_published ? 'badge-green' : 'badge-gray')}>
            {course.is_published ? 'Published' : 'Draft'}
          </span>
        </div>

        {/* Content */}
        <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-1">
          {course.title}
        </h3>
        {course.description && (
          <p className="mt-1 text-sm text-gray-500 line-clamp-2">{course.description}</p>
        )}

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {course.teacher.full_name}
          </span>
          {course.end_date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(course.end_date)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
