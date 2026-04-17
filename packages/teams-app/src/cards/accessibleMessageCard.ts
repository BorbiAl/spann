/**
 * Adaptive Cards for the "Spann: Make Accessible" task module.
 *
 * buildLoadingCard()         — shown immediately while AI processes
 * buildAccessibleMessageCard() — shown after processing completes
 * buildErrorCard()           — shown if processing fails
 */

import type { ProcessedMessage } from '../api/types.js';

const TONE_META: Record<string, { emoji: string; label: string; color: string }> = {
  URGENT:     { emoji: '🔴', label: 'Urgent',     color: 'Attention' },
  CASUAL:     { emoji: '😊', label: 'Casual',     color: 'Good' },
  FORMAL:     { emoji: '👔', label: 'Formal',     color: 'Accent' },
  AGGRESSIVE: { emoji: '⚠️', label: 'Aggressive', color: 'Attention' },
  SUPPORTIVE: { emoji: '💚', label: 'Supportive', color: 'Good' },
  NEUTRAL:    { emoji: '○',  label: 'Neutral',    color: 'Default' },
};

export function buildLoadingCard(): object {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      {
        type: 'TextBlock',
        text: 'Spann: Make Accessible',
        weight: 'Bolder',
        size: 'Large',
        color: 'Accent',
      },
      {
        type: 'TextBlock',
        text: '⏳ Running accessibility analysis…',
        wrap: true,
        spacing: 'Medium',
      },
      {
        type: 'TextBlock',
        text: 'Simplifying language and analysing tone. Usually takes less than 1 second.',
        wrap: true,
        isSubtle: true,
        size: 'Small',
        spacing: 'None',
      },
    ],
  };
}

export function buildAccessibleMessageCard(processed: ProcessedMessage): object {
  const tone = TONE_META[processed.tone_indicator] ?? TONE_META['NEUTRAL'];

  // Truncate long originals for display (full text is in processed.original_text)
  const displayOriginal =
    processed.original_text.length > 400
      ? processed.original_text.slice(0, 400) + '…'
      : processed.original_text;

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      {
        type: 'TextBlock',
        text: 'Spann: Accessibility Analysis',
        weight: 'Bolder',
        size: 'Large',
        color: 'Accent',
      },

      // ── Original ──────────────────────────────────────────────────────────
      {
        type: 'Container',
        style: 'emphasis',
        bleed: false,
        spacing: 'Medium',
        items: [
          {
            type: 'TextBlock',
            text: 'Original message',
            weight: 'Bolder',
            spacing: 'None',
            size: 'Small',
          },
          {
            type: 'TextBlock',
            text: displayOriginal,
            wrap: true,
            isSubtle: true,
            spacing: 'Small',
          },
        ],
      },

      // ── Simplified ────────────────────────────────────────────────────────
      {
        type: 'Container',
        style: 'good',
        bleed: false,
        spacing: 'Small',
        items: [
          {
            type: 'TextBlock',
            text: 'Simplified version',
            weight: 'Bolder',
            spacing: 'None',
            size: 'Small',
          },
          {
            type: 'TextBlock',
            text: processed.simplified,
            wrap: true,
            spacing: 'Small',
          },
        ],
      },

      // ── Metadata ──────────────────────────────────────────────────────────
      {
        type: 'FactSet',
        spacing: 'Medium',
        facts: [
          {
            title: 'Tone',
            value: `${tone.emoji} ${tone.label}`,
          },
          {
            title: 'Reading Level',
            value: `Grade ${processed.reading_level}`,
          },
          {
            title: 'Processed in',
            value: `${processed.processing_ms} ms`,
          },
        ],
      },
    ],
    actions: [
      {
        type: 'Action.Submit',
        title: '✓ Insert accessible version as reply',
        style: 'positive',
        data: {
          verb: 'insertAccessible',
          text: processed.simplified,
          toneIndicator: processed.tone_indicator,
          readingLevel: processed.reading_level,
        },
      },
      {
        type: 'Action.Submit',
        title: 'Dismiss',
        data: { verb: 'dismiss' },
      },
    ],
  };
}

export function buildErrorCard(message: string): object {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      {
        type: 'TextBlock',
        text: 'Spann: Make Accessible',
        weight: 'Bolder',
        size: 'Large',
        color: 'Accent',
      },
      {
        type: 'Container',
        style: 'attention',
        items: [
          {
            type: 'TextBlock',
            text: `⚠️ ${message}`,
            wrap: true,
            color: 'Attention',
          },
        ],
      },
    ],
    actions: [
      {
        type: 'Action.Submit',
        title: 'Close',
        data: { verb: 'dismiss' },
      },
    ],
  };
}
