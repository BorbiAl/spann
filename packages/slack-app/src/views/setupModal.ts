/**
 * /spann-setup modal view builder.
 *
 * Mirrors the App Home settings form as a proper modal so the user gets a
 * dedicated setup flow with a submit button rather than using the home tab.
 */

import type { ModalView } from '@slack/bolt';
import type { AccessibilityProfile, DisabilityType, ProfileSettings } from '../api/types.js';
import { ACTION, BLOCK } from './homeView.js';

export const SETUP_MODAL_CALLBACK_ID = 'spann_setup_modal';

/** Build the /spann-setup modal view. */
export function buildSetupModal(profile: AccessibilityProfile | null): ModalView {
  const activeTypes = new Set<DisabilityType>(
    (profile?.disability_types ?? []) as DisabilityType[],
  );
  const settings: ProfileSettings = (profile?.settings ?? {}) as ProfileSettings;

  const cognitiveLevel = settings.cognitive?.targetReadingLevel ?? 8;
  const captionsOn = settings.deaf?.captionsEnabled ?? false;
  const triggerWarningsOn = settings.anxiety?.triggerWarnings ?? false;
  const toneAlertsOn = settings.anxiety?.toneAlerts ?? false;
  const fontSize = settings.visual?.fontSize ?? 'md';

  const allDisabilities: DisabilityType[] = ['VISUAL', 'DEAF', 'MOTOR', 'COGNITIVE', 'DYSLEXIA', 'ANXIETY'];

  const disabilityLabels: Record<DisabilityType, { label: string; emoji: string }> = {
    VISUAL:    { label: 'Visual Impairment — alt text, screen reader, high contrast', emoji: '👁️' },
    DEAF:      { label: 'Deaf / Hard of Hearing — captions, transcripts, visual alerts', emoji: '🦻' },
    MOTOR:     { label: 'Motor Impairment — keyboard nav, large targets', emoji: '🦾' },
    COGNITIVE: { label: 'Cognitive Disability — simplified language, focus mode', emoji: '🧠' },
    DYSLEXIA:  { label: 'Dyslexia — bionic reading, OpenDyslexic font', emoji: '📖' },
    ANXIETY:   { label: 'Anxiety / Autism Spectrum — tone alerts, trigger warnings', emoji: '💙' },
  };

  const initialDisabilityOptions = allDisabilities
    .filter((d) => activeTypes.has(d))
    .map((type) => ({
      text: { type: 'plain_text' as const, text: `${disabilityLabels[type].emoji}  ${disabilityLabels[type].label.split(' — ')[0]}` },
      value: type,
    }));

  return {
    type: 'modal',
    callback_id: SETUP_MODAL_CALLBACK_ID,
    title: { type: 'plain_text', text: '♿  Spann Setup', emoji: true },
    submit: { type: 'plain_text', text: 'Save Profile', emoji: true },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Configure how Spann adapts messages for your accessibility needs.',
        },
      },
      { type: 'divider' },

      // Disability types
      {
        type: 'input',
        block_id: BLOCK.DISABILITY_TYPES,
        label: { type: 'plain_text', text: 'Accessibility Needs', emoji: true },
        optional: true,
        element: {
          type: 'checkboxes',
          action_id: ACTION.DISABILITY_TYPES,
          options: allDisabilities.map((type) => ({
            text: {
              type: 'plain_text' as const,
              text: `${disabilityLabels[type].emoji}  ${disabilityLabels[type].label.split(' — ')[0]}`,
              emoji: true,
            },
            description: {
              type: 'plain_text' as const,
              text: disabilityLabels[type].label.split(' — ')[1] ?? '',
            },
            value: type,
          })),
          ...(initialDisabilityOptions.length > 0
            ? { initial_options: initialDisabilityOptions }
            : {}),
        },
      },

      // Reading level
      {
        type: 'input',
        block_id: BLOCK.READING_LEVEL,
        label: { type: 'plain_text', text: '📖  Target Reading Level', emoji: true },
        hint: {
          type: 'plain_text',
          text: 'Simplified messages will target this Flesch-Kincaid grade level.',
        },
        element: {
          type: 'static_select',
          action_id: ACTION.READING_LEVEL,
          initial_option: { text: { type: 'plain_text', text: `Grade ${cognitiveLevel}` }, value: String(cognitiveLevel) },
          options: Array.from({ length: 12 }, (_, i) => ({
            text: { type: 'plain_text' as const, text: `Grade ${i + 1}` },
            value: String(i + 1),
          })),
        },
      },

      // Font size
      {
        type: 'input',
        block_id: BLOCK.FONT_SIZE,
        label: { type: 'plain_text', text: '🔡  Font Size', emoji: true },
        element: {
          type: 'static_select',
          action_id: ACTION.FONT_SIZE,
          initial_option: { text: { type: 'plain_text', text: fontSize.toUpperCase() }, value: fontSize },
          options: ['sm', 'md', 'lg', 'xl', '2xl'].map((s) => ({
            text: { type: 'plain_text' as const, text: s.toUpperCase() },
            value: s,
          })),
        },
      },

      // Toggles
      {
        type: 'input',
        block_id: BLOCK.CAPTIONS,
        label: { type: 'plain_text', text: '🎬  Auto-captions', emoji: true },
        element: {
          type: 'radio_buttons',
          action_id: ACTION.CAPTIONS,
          initial_option: captionsOn
            ? { text: { type: 'plain_text', text: 'On' }, value: 'true' }
            : { text: { type: 'plain_text', text: 'Off' }, value: 'false' },
          options: [
            { text: { type: 'plain_text', text: 'On' }, value: 'true' },
            { text: { type: 'plain_text', text: 'Off' }, value: 'false' },
          ],
        },
      },
      {
        type: 'input',
        block_id: BLOCK.TRIGGER_WARNINGS,
        label: { type: 'plain_text', text: '⚠️  Trigger warnings', emoji: true },
        element: {
          type: 'radio_buttons',
          action_id: ACTION.TRIGGER_WARNINGS,
          initial_option: triggerWarningsOn
            ? { text: { type: 'plain_text', text: 'On' }, value: 'true' }
            : { text: { type: 'plain_text', text: 'Off' }, value: 'false' },
          options: [
            { text: { type: 'plain_text', text: 'On' }, value: 'true' },
            { text: { type: 'plain_text', text: 'Off' }, value: 'false' },
          ],
        },
      },
      {
        type: 'input',
        block_id: BLOCK.TONE_ALERTS,
        label: { type: 'plain_text', text: '🎭  Tone alerts', emoji: true },
        element: {
          type: 'radio_buttons',
          action_id: ACTION.TONE_ALERTS,
          initial_option: toneAlertsOn
            ? { text: { type: 'plain_text', text: 'On' }, value: 'true' }
            : { text: { type: 'plain_text', text: 'Off' }, value: 'false' },
          options: [
            { text: { type: 'plain_text', text: 'On' }, value: 'true' },
            { text: { type: 'plain_text', text: 'Off' }, value: 'false' },
          ],
        },
      },
    ],
  };
}
