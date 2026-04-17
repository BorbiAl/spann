/**
 * Message event handler — the core accessibility processing pipeline.
 *
 * For every non-bot message in a channel where Spann is installed:
 *
 *  • COGNITIVE / DYSLEXIA  →  ephemeral: simplified version of the message
 *  • ANXIETY               →  ephemeral: tone indicator badge
 *  • VISUAL                →  check attachments for missing alt text, warn if absent
 *
 * The handler is intentionally non-blocking: a failure to process one message
 * must never affect subsequent messages.  All errors are logged and swallowed.
 */

import type { App, GenericMessageEvent } from '@slack/bolt';
import { spannApi } from '../api/client.js';
import type { AccessibilityProfile, ToneIndicator } from '../api/types.js';

// Tone metadata for the ephemeral badge
const TONE_BADGE: Record<ToneIndicator, string> = {
  URGENT:     '🚨 *URGENT* — This message has an urgent tone.',
  CASUAL:     '😊 *Casual* — This message has a relaxed, friendly tone.',
  FORMAL:     '💼 *Formal* — This message has a professional tone.',
  AGGRESSIVE: '⚠️ *Aggressive* — This message may have an aggressive tone. Remember: intent and impact can differ.',
  SUPPORTIVE: '💚 *Supportive* — This message has a warm, supportive tone.',
  NEUTRAL:    '➡️ *Neutral* — This message has a neutral tone.',
};

function isBotOrSystem(message: GenericMessageEvent): boolean {
  return (
    'bot_id' in message ||
    message.subtype === 'bot_message' ||
    message.subtype === 'channel_join' ||
    message.subtype === 'channel_leave' ||
    !message.text
  );
}

function needsProcessing(profile: AccessibilityProfile | null): boolean {
  if (!profile) return false;
  const types = profile.disability_types;
  return (
    types.includes('COGNITIVE') ||
    types.includes('DYSLEXIA') ||
    types.includes('ANXIETY') ||
    types.includes('VISUAL')
  );
}

export function registerMessageHandler(
  app: App,
  getWorkspaceId: (teamId: string) => Promise<string>,
): void {
  app.message(async ({ message, client, context, logger }) => {
    const msg = message as GenericMessageEvent;

    // Skip bot messages, system messages, and empty messages
    if (isBotOrSystem(msg)) return;

    const userId = msg.user;
    const channelId = msg.channel;
    const rawText = msg.text ?? '';
    const teamId = context.teamId ?? '';
    const threadTs = msg.thread_ts;

    // Guard: text must be non-trivial
    if (!userId || rawText.trim().length < 3) return;

    let workspaceId: string;
    try {
      workspaceId = await getWorkspaceId(teamId);
    } catch (err) {
      logger.error('message_handler_workspace_resolve_failed', { teamId, error: err });
      return;
    }

    // Fetch profile — uses cache, so this is fast on repeated messages
    let profile: AccessibilityProfile | null;
    try {
      profile = await spannApi.getProfile(userId, workspaceId);
    } catch (err) {
      logger.warn('message_handler_profile_fetch_failed', { userId, error: err });
      return;
    }

    if (!needsProcessing(profile)) return;

    const types = new Set(profile!.disability_types);

    // ── Single API call for cognitive/dyslexia + anxiety ─────────────────────
    // If the user has either simplification OR tone needs, one process call
    // gets us both results.
    const needsAI = types.has('COGNITIVE') || types.has('DYSLEXIA') || types.has('ANXIETY');

    if (needsAI) {
      try {
        const processed = await spannApi.processMessage(
          rawText,
          userId,
          channelId,
          workspaceId,
          threadTs,
        );

        // ── Simplified message (COGNITIVE / DYSLEXIA) ──────────────────────
        if (types.has('COGNITIVE') || types.has('DYSLEXIA')) {
          const settings = profile!.settings as { cognitive?: { simplifiedLanguage?: boolean } };
          const simplifyEnabled = settings.cognitive?.simplifiedLanguage !== false;

          if (simplifyEnabled && processed.simplified !== rawText) {
            await client.chat.postEphemeral({
              channel: channelId,
              user: userId,
              text: '♿ Simplified version',
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text:
                      `*♿  Simplified version* _(Grade ${processed.reading_level})_\n\n` +
                      processed.simplified,
                  },
                },
                {
                  type: 'context',
                  elements: [
                    { type: 'mrkdwn', text: '🤖  Spann Accessibility — simplified by AI' },
                  ],
                },
              ],
            });
          }
        }

        // ── Tone badge (ANXIETY) ───────────────────────────────────────────
        if (types.has('ANXIETY')) {
          const anxietySettings = (profile!.settings as { anxiety?: { toneAlerts?: boolean; aggressiveToneFilter?: boolean } }).anxiety;
          const toneAlertsOn = anxietySettings?.toneAlerts !== false;

          if (toneAlertsOn) {
            const badgeText = TONE_BADGE[processed.tone_indicator] ?? TONE_BADGE.NEUTRAL;

            await client.chat.postEphemeral({
              channel: channelId,
              user: userId,
              text: badgeText,
              blocks: [
                {
                  type: 'section',
                  text: { type: 'mrkdwn', text: `*🎭  Message tone:* ${badgeText}` },
                },
              ],
            });
          }
        }
      } catch (err) {
        // AI processing failure must never surface as a Slack error
        logger.warn('message_handler_ai_failed', { userId, channelId, error: err });
      }
    }

    // ── Alt text audit (VISUAL) ──────────────────────────────────────────────
    if (types.has('VISUAL') && 'files' in msg && Array.isArray(msg.files)) {
      const imagesWithoutAlt = (msg.files as Array<{ mimetype?: string; alt_txt?: string; name?: string }>)
        .filter((f) => f.mimetype?.startsWith('image/') && !f.alt_txt);

      if (imagesWithoutAlt.length > 0) {
        const count = imagesWithoutAlt.length;
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: `This message has ${count} image${count > 1 ? 's' : ''} without alt text.`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text:
                  `👁️  *Accessibility notice:* This message contains ${count} image${count > 1 ? 's' : ''} ` +
                  `without alt text.\n\nImages without descriptions are not accessible to screen reader users. ` +
                  `Ask the sender to add a description.`,
              },
            },
          ],
        }).catch((err: unknown) => {
          logger.warn('message_handler_alt_text_warn_failed', { error: err });
        });
      }
    }
  });
}
