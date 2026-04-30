import { describe, expect, it } from 'vitest'
import { cn } from '../cn'

describe('cn (className merge)', () => {
  it('joins multiple classes', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c')
  })

  it('strips falsy values', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b')
  })

  it('honours tailwind-merge precedence (last wins for conflicts)', () => {
    // tailwind-merge resolves conflicting Tailwind classes by keeping the last.
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('supports conditional shorthand via clsx', () => {
    const isActive = true
    expect(cn('base', isActive && 'active')).toBe('base active')
  })
})
