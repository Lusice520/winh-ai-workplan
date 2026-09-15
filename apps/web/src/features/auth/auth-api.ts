import { clearCachedCsrfToken, getJson, postJson } from '@/api/client/http'

export type CurrentSession = {
  accountId: string
  loginName: string
  displayName: string
  mustChangePassword: boolean
  bootstrapSystemAdministrator: boolean
}

export type LoginInput = {
  loginName: string
  password: string
}

export type ChangePasswordInput = {
  currentPassword: string
  newPassword: string
}

export function getCurrentSession(signal?: AbortSignal) {
  return getJson<CurrentSession>('/api/auth/me', { signal })
}

export function login(input: LoginInput) {
  return postJson<CurrentSession>('/api/auth/login', input)
}

export async function logout() {
  await postJson<void>('/api/auth/logout')
  clearCachedCsrfToken()
}

export function changePassword(input: ChangePasswordInput) {
  return postJson<CurrentSession>('/api/auth/password/change', input)
}
