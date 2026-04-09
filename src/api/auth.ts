import { apiClient } from './client'
import type { LoginResponse, RefreshResponse } from '../types/api'

export const authApi = {
  async login(
    email: string,
    password: string,
    deviceHint?: string,
  ): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>('/auth/login', {
      email,
      password,
      ...(deviceHint ? { device_hint: deviceHint } : {}),
    })
    return data
  },

  async register(
    email: string,
    password: string,
    name: string,
  ): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>('/auth/register', {
      email,
      password,
      name,
    })
    return data
  },

  async refresh(refreshToken: string): Promise<RefreshResponse> {
    const { data } = await apiClient.post<RefreshResponse>('/auth/refresh', {
      refresh_token: refreshToken,
    })
    return data
  },

  async logout(refreshToken: string): Promise<void> {
    await apiClient.post('/auth/logout', { refresh_token: refreshToken })
  },
}
