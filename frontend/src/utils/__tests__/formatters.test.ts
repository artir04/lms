import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatDateTime,
  formatFileSize,
  formatGrade,
} from '../formatters'

describe('formatGrade', () => {
  it('returns em-dash for null and undefined', () => {
    expect(formatGrade(null)).toBe('—')
    expect(formatGrade(undefined)).toBe('—')
  })

  it('returns em-dash for non-numeric strings', () => {
    expect(formatGrade('not-a-number')).toBe('—')
  })

  it('formats numbers to 2 decimal places', () => {
    expect(formatGrade(4)).toBe('4.00')
    expect(formatGrade(3.456)).toBe('3.46')
  })

  it('parses numeric strings before formatting', () => {
    expect(formatGrade('4.5')).toBe('4.50')
  })

  it('handles zero', () => {
    expect(formatGrade(0)).toBe('0.00')
  })
})

describe('formatFileSize', () => {
  it('renders bytes when below 1KB', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(512)).toBe('512 B')
  })

  it('renders kilobytes when between 1KB and 1MB', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
    expect(formatFileSize(1500)).toBe('1.5 KB')
  })

  it('renders megabytes for files >= 1MB', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB')
  })
})

describe('formatDate / formatDateTime', () => {
  it('renders an ISO date in human-friendly form', () => {
    // Use noon UTC to avoid timezone-dependent day rollovers.
    expect(formatDate('2026-04-30T12:00:00Z')).toBe('Apr 30, 2026')
  })

  it('formatDateTime includes the time component', () => {
    const out = formatDateTime('2026-04-30T15:30:00Z')
    // Time formatting depends on the runtime timezone; we only assert that the
    // output contains the date and an AM/PM marker.
    expect(out).toMatch(/Apr 30, 2026/)
    expect(out).toMatch(/(AM|PM)/)
  })
})
