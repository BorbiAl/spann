/**
 * Message activity handler.
 *
 * For every channel / group / personal message:
 *
 *  COGNITIVE | DYSLEXIA  → Reply in thread with simplified version
 *  DEAF                  → If text contains [AUDIO] or [VIDEO], generate caption
 *  VISUAL                → Flag image attachments that lack alt-text descriptions
 *  Any profile           → If tone = AGGRESSIVE, send proactive 1:1 warning
 */

import { CardFactory, MessageFactory, TurnContext } from 'botbuilder';
import type { Attachment, BotFrameworkAdapter } from 'botbuilder';
import { spannApi } from '../api/client.js';
import {
  storeConversationRef,
  sendToneWarning,
  type ConversationRefStore,
} from './proactiveNotifications.js';

/** Azure AD tenant ID + optional team display name from Teams channel data. */
interface TeamsChannelData {
  tenant?: { id?: string };
  team?: { id?: string; name?: string };
  channel?: { id?: string; displayName?: string };
  eventType?: string;
}

const IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
]);

function getTeamsChannelData(context: TurnContext): TeamsChannelData {
  return (context.activity.channelData ?? {}) as TeamsChannelData;
}

function getChannelId(context: TurnContext): string {
  const cd = getTeamsChannelData(context);
  return cd.channel?.id ?? context.activity.conversation?.id ?? '';
}

function getTeamName(context: TurnContext): string {
  const cd = getTeamsChannelData(context);
  return cd.team?.name ?? 'Microsoft Teams';
}

function isImageAttachment(attachment: Attachment): boolean {
  return IMAGE_MIME_TYPES.has(attachment.contentType ?? '');
}

/** True if the attachment appears to lack an alt-text description. */
function hasNoAltText(attachment: Attachment): boolean {
  // Teams doesn't expose a dedicated alt-text field.
  // We flag all images except those where the name looks descriptive
  // (i.e., not a raw filename like "photo.jpg" or "image001.png").
  const name = attachment.name ?? '';
  return /^(image|photo|img|screenshot|pic)\d*\.(png|jpe?g|gif|webp|bmp)$/i.test(name) || !name;
}

export async function handleMessageActivity(
  context: TurnContext,
  adapter: BotFrameworkAdapter,
  conversationRefs: ConversationRefStore,
  getWorkspaceId: (tenantId: string, teamName: string) => Promise<string>,
): Promise<void> {
  const activity = context.activity;

  // Ignore messages without text/attachments and bot-originated messages
  if (!activity.text && !activity.attachments?.length) return;
  if (activity.from?.role === 'bot') return;

  // Ignore system events (channel renamed, member added, etc.)
  const cd = getTeamsChannelData(context);
  if (cd.eventType) return;

  // Store a conversation reference so we can send proactive messages later
  storeConversationRef(conversationRefs, context);

  const userId = activity.from?.id ?? '';
  const tenantId = cd.tenant?.id ?? '';
  if (!userId || !tenantId) return;

  // Resolve the Spann workspace UUID for this tenant
  let workspaceId: string;
  try {
    workspaceId = await getWorkspaceId(tenantId, getTeamName(context));
  } catch {
    return;
  }

  // Fetch accessibility profile (TTL-cached)
  const profile = await spannApi.getProfile(userId, workspaceId).catch(() => null);
  if (!profile || !profile.disability_types.length) return;

  const types = new Set(profile.disability_types);
  const text = activity.text ?? '';
  const channelId = getChannelId(context);

  // ── COGNITIVE / DYSLEXIA: simplify message ────────────────────────────────
  const needsSimplification = types.has('COGNITIVE') || types.has('DYSLEXIA');

  if (text && (needsSimplification || profile.settings.anxiety?.toneAlerts)) {
    try {
      const processed = await spannApi.processMessage(
        text,
        userId,
        channelId,
        workspaceId,
        activity.replyToId,
      );

      if (needsSimplification) {
        const reply = MessageFactory.text(
          `**Spann simplified** *(Grade ${processed.reading_level}):*\n\n${processed.simplified}`,
        );
        reply.replyToId = activity.id;
        await context.sendActivity(reply);
      }

      // Proactive tone alert for AGGRESSIVE — sent as private 1:1 DM
      if (processed.tone_indicator === 'AGGRESSIVE') {
        await sendToneWarning(adapter, conversationRefs, userId, text).catch(() => {
          // Non-fatal — user may not have a stored personal conversation ref yet
        });
      }
    } catch {
      // Non-fatal — never disrupt the conversation flow on Spann errors
    }
  }

  // ── DEAF: generate caption for [AUDIO] or [VIDEO] tagged messages ─────────
  if (types.has('DEAF') && text && /\[(AUDIO|VIDEO)\]/i.test(text)) {
    try {
      const cleanText = text.replace(/\[(AUDIO|VIDEO)\]/gi, '').trim();
      if (cleanText) {
        const processed = await spannApi.processMessage(
          cleanText,
          userId,
          channelId,
          workspaceId,
        );
        const reply = MessageFactory.text(
          `**Spann caption:**\n\n${processed.simplified}`,
        );
        reply.replyToId = activity.id;
        await context.sendActivity(reply);
      }
    } catch {
      // Non-fatal
    }
  }

  // ── VISUAL: flag images without descriptive alt text ─────────────────────
  if (types.has('VISUAL') && activity.attachments?.length) {
    const flagged = activity.attachments.filter(
      (a) => isImageAttachment(a) && hasNoAltText(a),
    );

    if (flagged.length > 0) {
      const reply = MessageFactory.attachment(
        CardFactory.adaptiveCard({
          type: 'AdaptiveCard',
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          version: '1.5',
          body: [
            {
              type: 'Container',
              style: 'warning',
              items: [
                {
                  type: 'TextBlock',
                  text: '♿ Spann Accessibility Notice',
                  weight: 'Bolder',
                },
                {
                  type: 'TextBlock',
                  text: `This message contains ${flagged.length} image${flagged.length > 1 ? 's' : ''} without descriptive alt text. Screen reader users cannot perceive these images. Please add descriptions when resharing.`,
                  wrap: true,
                  spacing: 'Small',
                },
              ],
            },
          ],
        }),
      );
      reply.replyToId = activity.id;
      await context.sendActivity(reply);
    }
  }
}
