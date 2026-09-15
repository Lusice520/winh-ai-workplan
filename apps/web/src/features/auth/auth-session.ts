import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  changePassword,
  getCurrentSession,
  login,
  logout,
  type ChangePasswordInput,
  type LoginInput,
} from '@/features/auth/auth-api'

export const currentSessionQueryKey = ['auth', 'current-session'] as const

export function useCurrentSession() {
  return useQuery({
    queryKey: currentSessionQueryKey,
    queryFn: ({ signal }) => getCurrentSession(signal),
    retry: false,
    staleTime: 60_000,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: LoginInput) => login(input),
    onSuccess: (session) => {
      queryClient.setQueryData(currentSessionQueryKey, session)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: currentSessionQueryKey })
    },
  })
}

export function useChangePassword() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ChangePasswordInput) => changePassword(input),
    onSuccess: (session) => {
      queryClient.setQueryData(currentSessionQueryKey, session)
    },
  })
}
