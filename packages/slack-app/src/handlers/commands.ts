/**
 * Slash command handlers.
 *
 * /spann-setup   → opens accessibility profile modal
 * /spann-simplify [text] → returns AI-simplified version ephemerally
 * /spann-summary → summarises the last 20 channel messages
 */

import type { App } from '@slack/bolt';
import { spannApi } from '../api/client.js';
import { buildSetupModal } from '../views/setupModal.js';

export function registerCommandHandlers(
  app: App,
  getWorkspaceId: (teamId: string) => Promise<string>,
): void {

  // ── /spann-setup ──────────────────────────────────────────────────────────
  app.command('/spann-setup', async ({ command, ack, client, logger }) => {
    await ack();

    const userId = command.user_id;
    const teamId = command.team_id;

    try {
      const workspaceId = await getWorkspaceId(teamId);
      const profile = await spannApi.getProfile(userId, workspaceId);
      const modal = buildSetupModal(profile);

      await client.views.open({ trigger_id: command.trigger_id, view: modal });
    } catch (err) {
      logger.error('spann_setup_command_error', { userId, teamId, error: err });
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: userId,
        text: '⚠️  Spann could not open the setup form. Please try again.',
      });
    }
  });

  // ── /spann-simplify ───────────────────────────────────────────────────────
  app.command('/spann-simplify', async ({ command, ack, client, logger }) => {
    await ack();

    const userId = command.user_id;
    const teamId = command.team_id;
    const text = command.text.trim();

    if (!text) {
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: userId,
        text: '💡  Usage: `/spann-simplify <message text>`\n\nPaste any text and Spann will return a simplified version.',
      });
      return;
    }

    // Post a "processing…" message immediately so the user gets feedback
    let processingMsgTs: string | undefined;
    try {
      const result = await client.chat.postEphemeral({
        channel: command.channel_id,
        user: userId,
        text: '⏳  Simplifying…',
      });
      processingMsgTs = result.message_ts;
    } catch {
      // Non-fatal — carry on without the loading indicator
    }

    try {
      const workspaceId = await getWorkspaceId(teamId);
      const processed = await spannApi.processMessage(
        text,
        userId,
        command.channel_id,
        workspaceId,
      );

      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: userId,
        text: processed.simplified,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text:
                `*💬  Simplified* _(Grade ${processed.reading_level} · ${processed.processing_ms} ms)_\n\n` +
                processed.simplified,
            },
          },
          {
            type: 'context',
            elements: [
              { type: 'mrkdwn', text: '🤖  Spann AI · Use `/spann-setup` to adjust your reading level.' },
            ],
          },
        ],
      });
    } catch (err) {
      logger.error('spann_simplify_error', { userId, error: err });
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: userId,
        text: '⚠️  Spann could not simplify that text right now. Please try again.',
      });
    }

    void processingMsgTs; // referenced to satisfy strict no-unused-vars
  });

  // ── /spann-summary ────────────────────────────────────────────────────────
  app.command('/spann-summary', async ({ command, ack, client, logger }) => {
    await ack();

    const userId = command.user_id;
    const teamId = command.team_id;
    const channelId = command.channel_id;

    try {
      // 1. Fetch the last 20 messages
      const historyResult = await client.conversations.history({
        channel: channelId,
        limit: 20,
      });

      const rawMessages = (historyResult.messages ?? [])
        .filter(
          (m): m is { user: string; text: string } =>
            typeof m.text === 'string' &&
            m.text.length > 0 &&
            !('bot_id' in m) &&
            m.subtype === undefined,
        )
        .reverse() // chronological order
        .map((m) => ({ author_id: m.user, text: m.text }));

      if (rawMessages.length === 0) {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: '📭  There are no recent messages to summarise in this channel.',
        });
        return;
      }

      // 2. Call backend summary endpoint
      const workspaceId = await getWorkspaceId(teamId);
      const { summary, message_count } = await spannApi.summarizeThread(rawMessages, workspaceId);

      await client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text: summary,
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*📋  Thread Summary* _(last ${message_count} messages)_` },
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: summary },
          },
          {
            type: 'context',
            elements: [
              { type: 'mrkdwn', text: '🤖  Spann AI summary — may not capture every detail.' },
            ],
          },
        ],
      });
    } catch (err) {
      logger.error('spann_summary_error', { userId, channelId, error: err });
      await client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text: '⚠️  Spann could not summarise this channel right now. Please try again.',
      });
    }
  });
}
