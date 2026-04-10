import { apiClient } from './client'
import type { LoginResponse, RefreshResponse } from '../types/api'

type ApiEnvelope<T> = {
  data?: T
} & T

function unwrapEnvelope<T>(payload: ApiEnvelope<T>): T {
  return (payload?.data ?? payload) as T
}

export const authApi = {
  async login(
    email: string,
    password: string,
    deviceHint?: string,
  ): Promise<LoginResponse> {
    const { data } = await apiClient.post<ApiEnvelope<LoginResponse>>('/auth/login', {
      email,
      password,
      ...(deviceHint ? { device_hint: deviceHint } : {}),
    })
    return unwrapEnvelope(data)
  },

  async register(
    email: string,
    password: string,
    name: string,
    confirmPassword?: string,
    companyName?: string,
  ): Promise<LoginResponse> {
    const { data } = await apiClient.post<ApiEnvelope<LoginResponse>>('/auth/register', {
      email,
      password,
      ...(confirmPassword ? { confirm_password: confirmPassword } : {}),
      name,
      ...(companyName ? { company_name: companyName } : {}),
    })
    return unwrapEnvelope(data)
  },

  async refresh(refreshToken: string): Promise<RefreshResponse> {
    const { data } = await apiClient.post<ApiEnvelope<RefreshResponse>>('/auth/refresh', {
      refresh_token: refreshToken,
    })
    return unwrapEnvelope(data)
  },

  async logout(refreshToken: string): Promise<void> {
    await apiClient.post('/auth/logout', { refresh_token: refreshToken })
  },
}
