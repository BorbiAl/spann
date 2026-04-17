/**
 * Adaptive Card 1.5 — Accessibility Settings
 *
 * Rendered in:
 *  - Personal tab (client-side via adaptivecards JS SDK)
 *  - Welcome message when the bot is first added to a personal scope
 *
 * Action.Submit sends back an activity.value with shape:
 *   {
 *     verb: 'saveSettings',
 *     disabilityTypes: 'COGNITIVE,DYSLEXIA',  // comma-separated
 *     readingLevel: '8',
 *     captionsEnabled: 'true',
 *     toneAlerts: 'true',
 *     simplifiedLanguage: 'true',
 *   }
 */

import type { AccessibilityProfile } from '../api/types.js';

// Minimal AC 1.5 JSON types — we build plain objects, not using the npm SDK.
export interface AdaptiveCardJson {
  type: 'AdaptiveCard';
  $schema: string;
  version: string;
  body: unknown[];
  actions?: unknown[];
}

export function buildSettingsCard(profile: AccessibilityProfile | null): AdaptiveCardJson {
  const current = profile?.disability_types ?? [];
  const s = profile?.settings ?? {};

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      {
        type: 'TextBlock',
        text: 'Spann Accessibility Settings',
        weight: 'Bolder',
        size: 'Large',
        color: 'Accent',
      },
      {
        type: 'TextBlock',
        text: profile
          ? `Last updated: ${new Date(profile.updated_at).toLocaleDateString()}`
          : 'Set up your accessibility profile to personalise your Teams experience.',
        isSubtle: true,
        wrap: true,
        spacing: 'None',
      },
      { type: 'Separator', spacing: 'Medium' },

      // ── Disability types ──────────────────────────────────────────────────
      {
        type: 'TextBlock',
        text: 'My accessibility needs',
        weight: 'Bolder',
        spacing: 'Medium',
      },
      {
        type: 'Input.ChoiceSet',
        id: 'disabilityTypes',
        isMultiSelect: true,
        style: 'expanded',
        value: current.join(','),
        choices: [
          { title: '👁  Visual impairment (screen reader, high contrast, alt text)', value: 'VISUAL' },
          { title: '👂  Deaf / Hard of hearing (captions, transcripts)', value: 'DEAF' },
          { title: '🧠  Cognitive / Learning difficulties (simplified language)', value: 'COGNITIVE' },
          { title: '📖  Dyslexia (bionic reading, letter spacing)', value: 'DYSLEXIA' },
          { title: '💆  Anxiety / Autism-spectrum (tone alerts, trigger warnings)', value: 'ANXIETY' },
          { title: '🖐  Motor impairment (keyboard navigation, large targets)', value: 'MOTOR' },
        ],
      },

      { type: 'Separator', spacing: 'Medium' },

      // ── Reading level ─────────────────────────────────────────────────────
      {
        type: 'TextBlock',
        text: 'Target reading level',
        weight: 'Bolder',
        spacing: 'Medium',
      },
      {
        type: 'TextBlock',
        text: '1 = very simple (Grade 1) · 8 = average adult · 12 = advanced (Grade 12)',
        isSubtle: true,
        size: 'Small',
        spacing: 'None',
      },
      {
        type: 'Input.Number',
        id: 'readingLevel',
        placeholder: 'Enter a number from 1 to 12',
        min: 1,
        max: 12,
        value: String(s.cognitive?.targetReadingLevel ?? 8),
      },

      { type: 'Separator', spacing: 'Medium' },

      // ── Feature toggles ───────────────────────────────────────────────────
      {
        type: 'TextBlock',
        text: 'Feature toggles',
        weight: 'Bolder',
        spacing: 'Medium',
      },
      {
        type: 'Input.Toggle',
        id: 'simplifiedLanguage',
        title: 'Auto-simplify complex messages in channels',
        value: String(s.cognitive?.simplifiedLanguage ?? false),
      },
      {
        type: 'Input.Toggle',
        id: 'captionsEnabled',
        title: 'Generate captions for messages tagged [AUDIO] or [VIDEO]',
        value: String(s.deaf?.captionsEnabled ?? false),
        spacing: 'Small',
      },
      {
        type: 'Input.Toggle',
        id: 'toneAlerts',
        title: 'Alert me when messages have an aggressive or urgent tone',
        value: String(s.anxiety?.toneAlerts ?? false),
        spacing: 'Small',
      },
    ],
    actions: [
      {
        type: 'Action.Submit',
        title: 'Save Settings',
        style: 'positive',
        data: { verb: 'saveSettings' },
      },
    ],
  };
}
