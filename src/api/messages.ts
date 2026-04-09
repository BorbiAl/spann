import { apiClient } from './client'
import type { Message, MessagesPageResponse, ReactionSummary } from '../types/api'

export const messagesApi = {
  async list(
    channelId: string,
    cursor?: string,
    limit = 50,
  ): Promise<MessagesPageResponse> {
    const { data } = await apiClient.get<MessagesPageResponse>(
      `/channels/${channelId}/messages`,
      {
        params: {
          ...(cursor ? { cursor } : {}),
          limit,
        },
      },
    )
    return data
  },

  async send(
    channelId: string,
    text: string,
    meshOrigin = false,
    sourceLocale?: string,
  ): Promise<Message> {
    const { data } = await apiClient.post<Message>(
      `/channels/${channelId}/messages`,
      {
        content: text,
        mesh_origin: meshOrigin,
        ...(sourceLocale ? { source_locale: sourceLocale } : {}),
      },
    )
    return data
  },

  async edit(messageId: string, text: string): Promise<Message> {
    const { data } = await apiClient.patch<Message>(`/messages/${messageId}`, {
      content: text,
    })
    return data
  },

  async delete(messageId: string): Promise<void> {
    await apiClient.delete(`/messages/${messageId}`)
  },

  async react(messageId: string, emoji: string): Promise<ReactionSummary[]> {
    const { data } = await apiClient.post<ReactionSummary[]>(
      `/messages/${messageId}/reactions`,
      { emoji },
    )
    return data
  },
}
