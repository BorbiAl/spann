/**
 * Message shortcut handler — "Make Accessible"
 *
 * Right-click any message → More message shortcuts → Make Accessible
 *
 * The shortcut callback_id must match the value registered in your Slack
 * App Manifest → Interactivity → Message Shortcuts.
 *
 * Flow:
 *  1. ack() + open a loading modal immediately (< 3 s Slack deadline)
 *  2. Call the backend concurrently for: processMessage + suggestAccessibleResponse
 *  3. Update the modal with the full results
 */

import type { App, MessageShortcut } from '@slack/bolt';
import { spannApi } from '../api/client.js';
import { buildAccessibleModal, buildLoadingModal } from '../views/accessibleModal.js';
import type { ProcessedMessage } from '../api/types.js';

export const MAKE_ACCESSIBLE_CALLBACK_ID = 'make_accessible';

/** Sanitise Slack mrkdwn markup to plain text for AI processing. */
function slackToPlain(text: string): string {
  return text
    .replace(/<@[A-Z0-9]+>/g, '@user')
    .replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1')
    .replace(/<https?:\/\/[^|>]+\|([^>]+)>/g, '$1')
    .replace(/<https?:\/\/[^>]+>/g, '[link]')
    .replace(/<!(\w+)>/g, '@$1')
    .replace(/[*_~`]/g, '')
    .trim();
}

export function registerShortcutHandlers(
  app: App,
  getWorkspaceId: (teamId: string) => Promise<string>,
): void {
  app.shortcut(MAKE_ACCESSIBLE_CALLBACK_ID, async ({ shortcut, ack, client, logger }) => {
    // ack() must be called within 3 seconds — open loading modal immediately
    await ack();

    const ms = shortcut as MessageShortcut;
    const userId = ms.user.id;
    const teamId = ms.team.id;
    const rawText = ms.message.text ?? '';
    const plainText = slackToPlain(rawText);

    if (!plainText) {
      await client.views.open({
        trigger_id: ms.trigger_id,
        view: {
          type: 'modal',
          callback_id: 'spann_accessible_modal',
          title: { type: 'plain_text', text: '♿  Make Accessible', emoji: true },
          close: { type: 'plain_text', text: 'Close' },
          blocks: [
            {
              type: 'section',
              text: { type: 'mrkdwn', text: '⚠️  This message has no text to analyse.' },
            },
          ],
        },
      });
      return;
    }

    // Open loading modal while AI processes
    let viewId: string | undefined;
    try {
      const openResult = await client.views.open({
        trigger_id: ms.trigger_id,
        view: buildLoadingModal(),
      });
      viewId = openResult.view?.id;
    } catch (err) {
      logger.error('make_accessible_open_failed', { userId, error: err });
      return;
    }

    // ── Background: AI processing ─────────────────────────────────────────
    let processed: ProcessedMessage;
    let suggestions: string[] = [];

    try {
      const workspaceId = await getWorkspaceId(teamId);

      // Run processMessage and suggest in parallel
      const [processResult, profile] = await Promise.all([
        spannApi.processMessage(plainText, userId, ms.channel?.id ?? 'D_direct', workspaceId),
        spannApi.getProfile(userId, workspaceId),
      ]);

      processed = processResult;

      // Build 3 accessible reply suggestions via a second processing call
      // The backend's simplify endpoint doubles as a reply generator when
      // given a prompt framed as a reply context.
      // For now, generate 3 varied replies by calling the simplify endpoint
      // with different reading levels — a pragmatic approximation until
      // backend/api/main.py exposes a dedicated suggest-replies endpoint.
      if (profile) {
        const targetLevel = (profile.settings as { cognitive?: { targetReadingLevel?: number } }).cognitive?.targetReadingLevel ?? 8;
        const [s1, s2, s3] = await Promise.allSettled([
          spannApi.processMessage(`Reply to this at grade ${Math.max(1, targetLevel - 2)}: ${plainText}`, userId, 'suggest', workspaceId),
          spannApi.processMessage(`Reply to this at grade ${targetLevel}: ${plainText}`, userId, 'suggest', workspaceId),
          spannApi.processMessage(`Reply to this formally at grade ${Math.min(12, targetLevel + 2)}: ${plainText}`, userId, 'suggest', workspaceId),
        ]);
        suggestions = [s1, s2, s3]
          .filter((r): r is PromiseFulfilledResult<ProcessedMessage> => r.status === 'fulfilled')
          .map((r) => r.value.simplified);
      }
    } catch (err) {
      logger.error('make_accessible_ai_failed', { userId, error: err });

      if (viewId) {
        await client.views.update({
          view_id: viewId,
          view: {
            type: 'modal',
            callback_id: 'spann_accessible_modal',
            title: { type: 'plain_text', text: '♿  Make Accessible', emoji: true },
            close: { type: 'plain_text', text: 'Close' },
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: '⚠️  *Spann could not process this message right now.*\n\nPlease try again in a moment.',
                },
              },
            ],
          },
        }).catch(() => {});
      }
      return;
    }

    // Update modal with full results
    if (viewId) {
      await client.views
        .update({
          view_id: viewId,
          view: buildAccessibleModal(processed, suggestions),
        })
        .catch((err) => {
          logger.error('make_accessible_update_failed', { viewId, error: err });
        });
    }
  });
}
