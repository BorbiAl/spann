/**
 * App Home tab Block Kit builder.
 *
 * Returns a `home` view for views.publish().  All interactive elements use
 * deterministic block_id / action_id pairs that the actions handler reads back.
 */

import type { KnownBlock, View } from '@slack/web-api';
import type { AccessibilityProfile, DisabilityType, ProfileSettings } from '../api/types.js';

// ── Constants ─────────────────────────────────────────────────────────────────

export const BLOCK = {
  DISABILITY_TYPES: 'block_disability_types',
  FONT_SIZE: 'block_font_size',
  READING_LEVEL: 'block_reading_level',
  CAPTIONS: 'block_captions',
  TRIGGER_WARNINGS: 'block_trigger_warnings',
  TONE_ALERTS: 'block_tone_alerts',
} as const;

export const ACTION = {
  DISABILITY_TYPES: 'action_disability_types',
  FONT_SIZE: 'action_font_size',
  READING_LEVEL: 'action_reading_level',
  CAPTIONS: 'action_captions',
  TRIGGER_WARNINGS: 'action_trigger_warnings',
  TONE_ALERTS: 'action_tone_alerts',
  SAVE_SETTINGS: 'action_save_settings_home',
} as const;

const DISABILITY_LABELS: Record<DisabilityType, { label: string; description: string; emoji: string }> = {
  VISUAL:    { label: 'Visual Impairment',      description: 'Alt text, screen reader, high contrast',   emoji: '👁️' },
  DEAF:      { label: 'Deaf / Hard of Hearing', description: 'Auto-captions, transcript, visual alerts', emoji: '🦻' },
  MOTOR:     { label: 'Motor Impairment',        description: 'Keyboard navigation, large targets',       emoji: '🦾' },
  COGNITIVE: { label: 'Cognitive Disability',    description: 'Simplified language, focus mode',          emoji: '🧠' },
  DYSLEXIA:  { label: 'Dyslexia',               description: 'Bionic reading, letter spacing, OpenDyslexic font', emoji: '📖' },
  ANXIETY:   { label: 'Anxiety / Autism Spectrum', description: 'Tone alerts, trigger warnings, quiet mode', emoji: '💙' },
};

const ALL_DISABILITIES: DisabilityType[] = ['VISUAL', 'DEAF', 'MOTOR', 'COGNITIVE', 'DYSLEXIA', 'ANXIETY'];

// ── View builder ──────────────────────────────────────────────────────────────

/** Build the full App Home `home` view. */
export function buildHomeView(profile: AccessibilityProfile | null): View {
  const activeTypes = new Set<DisabilityType>(
    (profile?.disability_types ?? []) as DisabilityType[],
  );
  const settings: ProfileSettings = (profile?.settings ?? {}) as ProfileSettings;

  const initialDisabilityOptions = ALL_DISABILITIES.filter((d) => activeTypes.has(d)).map(
    disabilityOption,
  );

  const cognitiveLevel = settings.cognitive?.targetReadingLevel ?? 8;
  const captionsOn = settings.deaf?.captionsEnabled ?? false;
  const triggerWarningsOn = settings.anxiety?.triggerWarnings ?? false;
  const toneAlertsOn = settings.anxiety?.toneAlerts ?? false;
  const fontSize = settings.visual?.fontSize ?? 'md';

  const blocks: KnownBlock[] = [
    // ── Header ─────────────────────────────────────────────────────────────
    {
      type: 'header',
      text: { type: 'plain_text', text: '♿  Your Accessibility Settings', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          'Spann adapts every message in channels where it is installed to match your ' +
          'accessibility needs. Configure your profile below — changes take effect immediately.',
      },
    },
    { type: 'divider' },

    // ── Disability type checkboxes ─────────────────────────────────────────
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*Step 1 — Select your accessibility needs*' },
    },
    {
      type: 'input',
      block_id: BLOCK.DISABILITY_TYPES,
      label: { type: 'plain_text', text: 'Disability / Access Need', emoji: true },
      optional: true,
      element: {
        type: 'checkboxes',
        action_id: ACTION.DISABILITY_TYPES,
        options: ALL_DISABILITIES.map(disabilityOption),
        ...(initialDisabilityOptions.length > 0
          ? { initial_options: initialDisabilityOptions }
          : {}),
      },
    },
    { type: 'divider' },

    // ── Display preferences ────────────────────────────────────────────────
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*Step 2 — Display preferences*' },
    },

    // Font size
    {
      type: 'input',
      block_id: BLOCK.FONT_SIZE,
      label: { type: 'plain_text', text: '🔡  Font Size', emoji: true },
      element: {
        type: 'static_select',
        action_id: ACTION.FONT_SIZE,
        placeholder: { type: 'plain_text', text: 'Choose font size' },
        initial_option: fontSizeOption(fontSize),
        options: [
          { text: { type: 'plain_text', text: 'Small' }, value: 'sm' },
          { text: { type: 'plain_text', text: 'Medium (default)' }, value: 'md' },
          { text: { type: 'plain_text', text: 'Large' }, value: 'lg' },
          { text: { type: 'plain_text', text: 'Extra Large' }, value: 'xl' },
          { text: { type: 'plain_text', text: 'XXL' }, value: '2xl' },
        ],
      },
    },

    // Reading level
    {
      type: 'input',
      block_id: BLOCK.READING_LEVEL,
      label: { type: 'plain_text', text: '📖  Target Reading Level (Flesch-Kincaid grade)', emoji: true },
      hint: {
        type: 'plain_text',
        text: 'Grade 3 = very simple  ·  Grade 8 = standard news  ·  Grade 12 = academic',
      },
      element: {
        type: 'static_select',
        action_id: ACTION.READING_LEVEL,
        placeholder: { type: 'plain_text', text: 'Choose reading level' },
        initial_option: readingLevelOption(cognitiveLevel),
        options: Array.from({ length: 12 }, (_, i) => readingLevelOption(i + 1)),
      },
    },
    { type: 'divider' },

    // ── Toggles ────────────────────────────────────────────────────────────
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*Step 3 — Feature toggles*' },
    },
    {
      type: 'input',
      block_id: BLOCK.CAPTIONS,
      label: { type: 'plain_text', text: '🎬  Auto-captions for audio & video', emoji: true },
      element: {
        type: 'radio_buttons',
        action_id: ACTION.CAPTIONS,
        initial_option: captionsOn
          ? { text: { type: 'plain_text', text: 'Enabled' }, value: 'true' }
          : { text: { type: 'plain_text', text: 'Disabled' }, value: 'false' },
        options: [
          { text: { type: 'plain_text', text: 'Enabled' }, value: 'true' },
          { text: { type: 'plain_text', text: 'Disabled' }, value: 'false' },
        ],
      },
    },
    {
      type: 'input',
      block_id: BLOCK.TRIGGER_WARNINGS,
      label: { type: 'plain_text', text: '⚠️  Trigger warnings on potentially distressing messages', emoji: true },
      element: {
        type: 'radio_buttons',
        action_id: ACTION.TRIGGER_WARNINGS,
        initial_option: triggerWarningsOn
          ? { text: { type: 'plain_text', text: 'Enabled' }, value: 'true' }
          : { text: { type: 'plain_text', text: 'Disabled' }, value: 'false' },
        options: [
          { text: { type: 'plain_text', text: 'Enabled' }, value: 'true' },
          { text: { type: 'plain_text', text: 'Disabled' }, value: 'false' },
        ],
      },
    },
    {
      type: 'input',
      block_id: BLOCK.TONE_ALERTS,
      label: { type: 'plain_text', text: '🎭  Tone indicator badge on each message', emoji: true },
      element: {
        type: 'radio_buttons',
        action_id: ACTION.TONE_ALERTS,
        initial_option: toneAlertsOn
          ? { text: { type: 'plain_text', text: 'Enabled' }, value: 'true' }
          : { text: { type: 'plain_text', text: 'Disabled' }, value: 'false' },
        options: [
          { text: { type: 'plain_text', text: 'Enabled' }, value: 'true' },
          { text: { type: 'plain_text', text: 'Disabled' }, value: 'false' },
        ],
      },
    },
    { type: 'divider' },

    // ── Save button ────────────────────────────────────────────────────────
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '💾  Save Settings', emoji: true },
          style: 'primary',
          action_id: ACTION.SAVE_SETTINGS,
          value: 'save',
        },
      ],
    },

    // ── Status footer (shown when profile exists) ──────────────────────────
    ...(profile
      ? ([
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `✅  Profile active · Last updated <!date^${Math.floor(new Date(profile.updated_at).getTime() / 1000)}^{date_short_pretty} at {time}|${profile.updated_at}>`,
              },
            ],
          },
        ] satisfies KnownBlock[])
      : ([
          {
            type: 'context',
            elements: [
              { type: 'mrkdwn', text: '💡  No profile yet — select your needs above and click *Save Settings*.' },
            ],
          },
        ] satisfies KnownBlock[])),
  ];

  return { type: 'home', blocks };
}

// ── Helper factories ──────────────────────────────────────────────────────────

function disabilityOption(type: DisabilityType) {
  const { label, description, emoji } = DISABILITY_LABELS[type];
  return {
    text: { type: 'mrkdwn' as const, text: `*${emoji}  ${label}*\n${description}` },
    value: type,
  };
}

function fontSizeOption(size: string) {
  const labels: Record<string, string> = {
    sm: 'Small', md: 'Medium (default)', lg: 'Large', xl: 'Extra Large', '2xl': 'XXL',
  };
  return {
    text: { type: 'plain_text' as const, text: labels[size] ?? 'Medium (default)' },
    value: size,
  };
}

function readingLevelOption(grade: number) {
  const descriptions: Record<number, string> = {
    1: 'Grade 1 — Very simple', 2: 'Grade 2', 3: 'Grade 3', 4: 'Grade 4',
    5: 'Grade 5', 6: 'Grade 6', 7: 'Grade 7',
    8: 'Grade 8 — Standard news',
    9: 'Grade 9', 10: 'Grade 10', 11: 'Grade 11',
    12: 'Grade 12 — Academic',
  };
  return {
    text: { type: 'plain_text' as const, text: descriptions[grade] ?? `Grade ${grade}` },
    value: String(grade),
  };
}
