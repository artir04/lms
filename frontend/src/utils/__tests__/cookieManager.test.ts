/**
 * Unit tests for cookieManager — drives document.cookie via jsdom.
 *
 * Each test starts from a clean cookie jar (afterEach in setupTests handles
 * RTL cleanup; we manually clear cookies in beforeEach to avoid bleed-through
 * because document.cookie is a global string).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cookieManager } from '../cookieManager'

function clearAllCookies() {
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0].trim()
    if (name) document.cookie = `${name}=; path=/; max-age=0`
  })
}

describe('cookieManager', () => {
  beforeEach(clearAllCookies)
  afterEach(clearAllCookies)

  it('returns null for a cookie that does not exist', () => {
    expect(cookieManager.get('absent')).toBeNull()
    expect(cookieManager.has('absent')).toBe(false)
  })

  it('round-trips a simple value via set + get', () => {
    cookieManager.set('token', 'abc123')
    expect(cookieManager.get('token')).toBe('abc123')
    expect(cookieManager.has('token')).toBe(true)
  })

  it('url-encodes the value so special chars survive a round-trip', () => {
    const value = 'a b=c;d/e&f'
    cookieManager.set('weird', value)
    expect(cookieManager.get('weird')).toBe(value)
  })

  it('isolates two distinct cookies by name', () => {
    cookieManager.set('access', 'A')
    cookieManager.set('refresh', 'B')
    expect(cookieManager.get('access')).toBe('A')
    expect(cookieManager.get('refresh')).toBe('B')
  })

  it('returns null after delete()', () => {
    cookieManager.set('to-remove', 'x')
    expect(cookieManager.has('to-remove')).toBe(true)
    cookieManager.delete('to-remove')
    expect(cookieManager.has('to-remove')).toBe(false)
    expect(cookieManager.get('to-remove')).toBeNull()
  })

  it('does not return a partial-name match', () => {
    cookieManager.set('access', 'real')
    // 'acc' is a prefix of 'access' — must NOT match.
    expect(cookieManager.get('acc')).toBeNull()
  })
})
