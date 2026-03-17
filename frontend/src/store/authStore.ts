import { create } from 'zustand'
import type { User } from '@/types/user'
import { cookieManager } from '@/utils/cookieManager'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setUser: (user: User) => void
  setTokens: (access: string, refresh: string) => void
  logout: () => void
  initializeFromCookies: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: cookieManager.get('accessToken'),
  refreshToken: cookieManager.get('refreshToken'),
  isAuthenticated: cookieManager.has('accessToken'),

  setUser: (user) => set({ user }),

  setTokens: (accessToken, refreshToken) => {
    // Save tokens to cookies (default: 7 days, secure, httpOnly-like)
    cookieManager.set('accessToken', accessToken, {
      maxAge: 15 * 60, // 15 minutes
      secure: true,
      sameSite: 'Lax',
    })
    cookieManager.set('refreshToken', refreshToken, {
      maxAge: 7 * 24 * 60 * 60, // 7 days
      secure: true,
      sameSite: 'Lax',
    })
    set({ accessToken, refreshToken, isAuthenticated: true })
  },

  logout: () => {
    cookieManager.delete('accessToken')
    cookieManager.delete('refreshToken')
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
  },

  initializeFromCookies: () => {
    const accessToken = cookieManager.get('accessToken')
    const refreshToken = cookieManager.get('refreshToken')
    const isAuthenticated = accessToken !== null
    set({ accessToken, refreshToken, isAuthenticated })
  },
}))
