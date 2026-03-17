/**
 * Cookie utilities for managing JWT tokens with httpOnly restrictions
 */

interface CookieOptions {
  maxAge?: number
  path?: string
  domain?: string
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

export const cookieManager = {
  /**
   * Set a cookie value
   */
  set: (name: string, value: string, options: CookieOptions = {}) => {
    const {
      maxAge = 7 * 24 * 60 * 60, // 7 days default
      path = '/',
      secure = true,
      sameSite = 'Lax',
    } = options

    let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`
    cookieString += `; path=${path}`
    cookieString += `; max-age=${maxAge}`
    cookieString += `; samesite=${sameSite}`
    if (secure) cookieString += '; secure'
    if (options.domain) cookieString += `; domain=${options.domain}`

    document.cookie = cookieString
  },

  /**
   * Get a cookie value
   */
  get: (name: string): string | null => {
    const nameEQ = `${encodeURIComponent(name)}=`
    const cookies = document.cookie.split(';')

    for (let cookie of cookies) {
      cookie = cookie.trim()
      if (cookie.startsWith(nameEQ)) {
        return decodeURIComponent(cookie.substring(nameEQ.length))
      }
    }

    return null
  },

  /**
   * Delete a cookie
   */
  delete: (name: string, options: Partial<CookieOptions> = {}) => {
    const { path = '/', domain = options.domain } = options
    let cookieString = `${encodeURIComponent(name)}=; path=${path}; max-age=0`
    if (domain) cookieString += `; domain=${domain}`
    document.cookie = cookieString
  },

  /**
   * Check if a cookie exists
   */
  has: (name: string): boolean => {
    return cookieManager.get(name) !== null
  },
}
