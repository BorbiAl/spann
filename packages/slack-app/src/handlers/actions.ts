/**
 * Block Kit action handlers.
 *
 * - action_save_settings_home  → saves profile from App Home "Save Settings" button
 * - spann_setup_modal          → saves profile on /spann-setup modal submit
 * - copy_reply_*               → acknowledges copy-reply buttons in the accessible modal
 */

import type { App } from '@slack/bolt';
import type { ViewStateValue } from '@slack/bolt';
import { spannApi } from '../api/client.js';
import { buildHomeView } from '../views/homeView.js';
import { ACTION, BLOCK } from '../views/homeView.js';
import { SETUP_MODAL_CALLBACK_ID } from '../views/setupModal.js';
import type { DisabilityType, ProfileSettings } from '../api/types.js';

// ── State extraction helpers ──────────────────────────────────────────────────

function extractDisabilityTypes(state: ViewStateValue): DisabilityType[] {
  const options =
    state[BLOCK.DISABILITY_TYPES]?.[ACTION.DISABILITY_TYPES]?.selected_options ?? [];
  return (options as Array<{ value: string }>).map((o) => o.value as DisabilityType);
}

function extractFontSize(state: ViewStateValue): string {
  return (
    state[BLOCK.FONT_SIZE]?.[ACTION.FONT_SIZE]?.selected_option?.value ?? 'md'
  );
}

function extractReadingLevel(state: ViewStateValue): number {
  const raw = state[BLOCK.READING_LEVEL]?.[ACTION.READING_LEVEL]?.selected_option?.value;
  return raw ? parseInt(raw, 10) : 8;
}

function extractBool(state: ViewStateValue, blockId: string, actionId: string): boolean {
  return state[blockId]?.[actionId]?.selected_option?.value === 'true';
}

function stateToSettings(state: ViewStateValue): ProfileSettings {
  const captionsOn = extractBool(state, BLOCK.CAPTIONS, ACTION.CAPTIONS);
  const triggerWarnings = extractBool(state, BLOCK.TRIGGER_WARNINGS, ACTION.TRIGGER_WARNINGS);
  const toneAlerts = extractBool(state, BLOCK.TONE_ALERTS, ACTION.TONE_ALERTS);
  const fontSize = extractFontSize(state);
  const readingLevel = extractReadingLevel(state);

  return {
    visual: { fontSize: fontSize as ProfileSettings['visual'] extends { fontSize?: infer F } ? F : never },
    cognitive: { simplifiedLanguage: true, targetReadingLevel: readingLevel },
    deaf: { captionsEnabled: captionsOn, transcriptAutoGenerate: captionsOn },
    anxiety: { triggerWarnings, toneAlerts },
    dyslexia: { dyslexicFont: false, bionicReading: false },
    motor: { keyboardNavOnly: false, largeClickTargets: false },
  } satisfies ProfileSettings;
}

// ── Handler registration ──────────────────────────────────────────────────────

export function registerActionHandlers(
  app: App,
  getWorkspaceId: (teamId: string) => Promise<string>,
): void {

  // ── App Home "Save Settings" button ────────────────────────────────────────
  app.action(ACTION.SAVE_SETTINGS, async ({ ack, body, client, logger }) => {
    await ack();

    const userId = body.user.id;
    const teamId = body.team?.id ?? '';
    const state = (body as { view?: { state?: { values?: ViewStateValue } } }).view?.state?.values;

    if (!state) {
      logger.warn('save_settings_home_no_state', { userId });
      return;
    }

    try {
      const workspaceId = await getWorkspaceId(teamId);
      const disabilityTypes = extractDisabilityTypes(state);
      const settings = stateToSettings(state);

      // Fetch display name for the user record
      let displayName: string | undefined;
      try {
        const userInfo = await client.users.info({ user: userId });
        displayName = userInfo.user?.profile?.display_name ?? userInfo.user?.real_name ?? undefined;
      } catch {
        // Non-fatal — display name is optional
      }

      await spannApi.upsertProfile(userId, workspaceId, disabilityTypes, settings, displayName);

      // Re-render the Home tab with the updated profile (shows "Last updated" timestamp)
      const updatedProfile = await spannApi.getProfile(userId, workspaceId);
      const updatedView = buildHomeView(updatedProfile);

      await client.views.publish({ user_id: userId, view: updatedView });

      logger.info('settings_saved', { userId, disabilityTypes });
    } catch (err) {
      logger.error('save_settings_home_error', { userId, error: err });

      // Show an error banner without destroying the user's unsaved form
      await client.views.publish({
        user_id: userId,
        view: {
          type: 'home',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '⚠️  *Could not save settings.* Please try again. If the problem persists, contact your workspace admin.',
              },
            },
          ],
        },
      }).catch(() => {});
    }
  });

  // ── /spann-setup modal submit ──────────────────────────────────────────────
  app.view(SETUP_MODAL_CALLBACK_ID, async ({ ack, view, body, client, logger }) => {
    await ack();

    const userId = body.user.id;
    const teamId = body.team?.id ?? '';
    const state = view.state.values;

    try {
      const workspaceId = await getWorkspaceId(teamId);
      const disabilityTypes = extractDisabilityTypes(state);
      const settings = stateToSettings(state);

      let displayName: string | undefined;
      try {
        const userInfo = await client.users.info({ user: userId });
        displayName = userInfo.user?.profile?.display_name ?? userInfo.user?.real_name ?? undefined;
      } catch {
        // Non-fatal
      }

      await spannApi.upsertProfile(userId, workspaceId, disabilityTypes, settings, displayName);

      // Refresh the home tab after modal submit
      const updatedProfile = await spannApi.getProfile(userId, workspaceId);
      const updatedView = buildHomeView(updatedProfile);

      await client.views.publish({ user_id: userId, view: updatedView }).catch(() => {});

      logger.info('setup_modal_saved', { userId, disabilityTypes });
    } catch (err) {
      logger.error('setup_modal_save_error', { userId, error: err });
    }
  });

  // ── Copy-reply buttons (accessible modal) ─────────────────────────────────
  // These are cosmetic — the user copies the suggestion manually.
  // We just ack() so Slack doesn't show a timeout error.
  for (let i = 0; i < 3; i++) {
    app.action(`copy_reply_${i}`, async ({ ack }) => {
      await ack();
    });
  }
}
