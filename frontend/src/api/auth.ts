import { useMutation } from '@tanstack/react-query'
import api from '@/config/axios'
import { useAuthStore } from '@/store/authStore'
import type { LoginRequest, TokenResponse } from '@/types/auth'

export function useLogin() {
  const { setTokens } = useAuthStore()
  return useMutation({
    mutationFn: (data: LoginRequest) =>
      api.post<TokenResponse>('/auth/login', data).then((r) => r.data),
    onSuccess: (data) => setTokens(data.access_token, data.refresh_token),
  })
}

export function useLogout() {
  const { logout } = useAuthStore()
  return useMutation({
    mutationFn: async () => { logout() },
  })
}
