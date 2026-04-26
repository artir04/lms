import { useMutation } from '@tanstack/react-query'
import api from '@/config/axios'
import { useAuthStore } from '@/store/authStore'
import type {
  LoginRequest,
  TokenResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from '@/types/auth'

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
    mutationFn: async () => {
      logout()
    },
  })
}

interface MessageResponse {
  message: string
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (data: ForgotPasswordRequest) =>
      api.post<MessageResponse>('/auth/forgot-password', data).then((r) => r.data),
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (data: ResetPasswordRequest) =>
      api.post<MessageResponse>('/auth/reset-password', data).then((r) => r.data),
  })
}
