import { create } from 'zustand'
import type { UnderstandResult } from '../api/understand'

/** Compound cache key — invalidates when reading level or language changes */
export function understandKey(messageId: string, readingLevel: string, language: string): string {
  return `${messageId}:${readingLevel}:${language}`
}

interface UnderstandStore {
  /** Per-message simplified text cache */
  simplifiedCache: Record<string, string>
  /** Per-message full result cache */
  understandCache: Record<string, UnderstandResult>
  /** Message ID whose explain modal is open */
  explainMessageId: string | null
  /** Message ID currently being read aloud */
  speakingMessageId: string | null

  setSimplified: (messageId: string, text: string) => void
  setUnderstand: (messageId: string, result: UnderstandResult) => void
  openExplain: (messageId: string) => void
  closeExplain: () => void
  setSpeaking: (messageId: string | null) => void
}

export const useUnderstandStore = create<UnderstandStore>((set) => ({
  simplifiedCache: {},
  understandCache: {},
  explainMessageId: null,
  speakingMessageId: null,

  setSimplified: (messageId, text) =>
    set((s) => ({ simplifiedCache: { ...s.simplifiedCache, [messageId]: text } })),

  setUnderstand: (messageId, result) =>
    set((s) => ({ understandCache: { ...s.understandCache, [messageId]: result } })),

  openExplain: (messageId) => set({ explainMessageId: messageId }),
  closeExplain: () => set({ explainMessageId: null }),
  setSpeaking: (messageId) => set({ speakingMessageId: messageId }),
}))
