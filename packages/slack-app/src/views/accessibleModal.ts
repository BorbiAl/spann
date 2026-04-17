/**
 * "Make Accessible" message shortcut modal view builder.
 *
 * Shows the AI accessibility analysis of any message: simplified text,
 * tone classification, reading level, and three suggested accessible replies.
 */

import type { ModalView } from '@slack/bolt';
import type { KnownBlock } from '@slack/web-api';
import type { ProcessedMessage, ToneIndicator } from '../api/types.js';

export const ACCESSIBLE_MODAL_CALLBACK_ID = 'spann_accessible_modal';

const TONE_META: Record<ToneIndicator, { emoji: string; label: string; color: string }> = {
  URGENT:     { emoji: '🚨', label: 'Urgent',     color: 'danger' },
  CASUAL:     { emoji: '😊', label: 'Casual',     color: 'good' },
  FORMAL:     { emoji: '💼', label: 'Formal',     color: 'primary' },
  AGGRESSIVE: { emoji: '⚠️',  label: 'Aggressive', color: 'danger' },
  SUPPORTIVE: { emoji: '💚', label: 'Supportive', color: 'good' },
  NEUTRAL:    { emoji: '➡️',  label: 'Neutral',    color: 'primary' },
};

/**
 * Build the "Make Accessible" results modal.
 *
 * @param processed  AI processing result from the backend.
 * @param suggestions Three accessible reply suggestions (or empty array).
 */
export function buildAccessibleModal(
  processed: ProcessedMessage,
  suggestions: string[],
): ModalView {
  const tone = TONE_META[processed.tone_indicator] ?? TONE_META.NEUTRAL;
  const gradeLabel = gradeDescription(processed.reading_level);
  const paddedSuggestions = [...suggestions, ...Array(3).fill('')].slice(0, 3) as [string, string, string];

  const blocks: KnownBlock[] = [
    // ── Original ────────────────────────────────────────────────────────────
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*📝  Original Message*' },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `> ${processed.original_text.replace(/\n/g, '\n> ')}`,
      },
    },
    { type: 'divider' },

    // ── Simplified ──────────────────────────────────────────────────────────
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*💬  Simplified Version*' },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: processed.simplified },
    },
    { type: 'divider' },

    // ── Tone + Reading Level ─────────────────────────────────────────────
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*🎭  Tone*\n${tone.emoji}  ${tone.label}`,
        },
        {
          type: 'mrkdwn',
          text: `*📖  Reading Level*\n${gradeLabel}`,
        },
        {
          type: 'mrkdwn',
          text: `*⚡  AI Latency*\n${processed.processing_ms} ms`,
        },
      ],
    },
    { type: 'divider' },

    // ── Suggested replies ────────────────────────────────────────────────
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*💡  Suggested Accessible Replies*' },
    },

    ...paddedSuggestions.map((suggestion, i): KnownBlock => {
      if (!suggestion) return { type: 'divider' };
      return {
        type: 'section',
        text: { type: 'mrkdwn', text: `*${i + 1}.* ${suggestion}` },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: 'Copy', emoji: true },
          value: suggestion,
          action_id: `copy_reply_${i}`,
        },
      };
    }),

    // ── Footer ────────────────────────────────────────────────────────────
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '🤖  Powered by Spann AI  ·  Results are AI-generated and may not be perfect.',
        },
      ],
    },
  ];

  return {
    type: 'modal',
    callback_id: ACCESSIBLE_MODAL_CALLBACK_ID,
    title: { type: 'plain_text', text: '♿  Accessibility Analysis', emoji: true },
    close: { type: 'plain_text', text: 'Close' },
    blocks,
  };
}

/** Build a loading modal shown immediately while AI processes in the background. */
export function buildLoadingModal(): ModalView {
  return {
    type: 'modal',
    callback_id: ACCESSIBLE_MODAL_CALLBACK_ID,
    title: { type: 'plain_text', text: '♿  Accessibility Analysis', emoji: true },
    close: { type: 'plain_text', text: 'Close' },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '⏳  *Analysing message…*\n\nSpann is simplifying the text and detecting tone. This usually takes under a second.',
        },
      },
    ],
  };
}

function gradeDescription(grade: number): string {
  const map: Record<number, string> = {
    1: 'Grade 1 — Very simple', 2: 'Grade 2', 3: 'Grade 3', 4: 'Grade 4',
    5: 'Grade 5', 6: 'Grade 6', 7: 'Grade 7',
    8: 'Grade 8 — Standard news', 9: 'Grade 9',
    10: 'Grade 10', 11: 'Grade 11', 12: 'Grade 12 — Academic',
  };
  return map[grade] ?? `Grade ${grade}`;
}
