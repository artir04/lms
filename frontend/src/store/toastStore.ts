import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  type: ToastType
  title?: string
  message: string
  duration: number
}

export interface ToastInput {
  type?: ToastType
  title?: string
  message: string
  duration?: number
}

interface ToastState {
  toasts: Toast[]
  push: (input: ToastInput) => string
  dismiss: (id: string) => void
  clear: () => void
}

const DEFAULT_DURATION = 4500

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: ({ type = 'info', title, message, duration = DEFAULT_DURATION }) => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    set((state) => ({
      toasts: [...state.toasts, { id, type, title, message, duration }],
    }))
    return id
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}))

export const toast = {
  success: (message: string, opts?: Omit<ToastInput, 'message' | 'type'>) =>
    useToastStore.getState().push({ ...opts, message, type: 'success' }),
  error: (message: string, opts?: Omit<ToastInput, 'message' | 'type'>) =>
    useToastStore.getState().push({ ...opts, message, type: 'error' }),
  info: (message: string, opts?: Omit<ToastInput, 'message' | 'type'>) =>
    useToastStore.getState().push({ ...opts, message, type: 'info' }),
  warning: (message: string, opts?: Omit<ToastInput, 'message' | 'type'>) =>
    useToastStore.getState().push({ ...opts, message, type: 'warning' }),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
  clear: () => useToastStore.getState().clear(),
}
