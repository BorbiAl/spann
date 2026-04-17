/**
 * Proactive notification helpers.
 *
 * ConversationReference objects are stored per-user (bot framework user ID)
 * so the bot can later open a 1:1 conversation with the user without them
 * having sent a message first.
 *
 * References are stored in memory for the process lifetime. In a multi-instance
 * deployment, back this store with Redis or a shared database.
 */

import { CardFactory, MessageFactory, TurnContext } from 'botbuilder';
import type { BotFrameworkAdapter, ConversationReference } from 'botbuilder';
import { buildToneWarningCard } from '../cards/proactiveCard.js';
import { spannApi } from '../api/client.js';
import type { DisabilityType, ProfileSettings } from '../api/types.js';

export type ConversationRefStore = Map<string, Partial<ConversationReference>>;

/**
 * Capture and store the conversation reference from the current turn.
 * Call this on every incoming message so we can reach users proactively.
 */
export function storeConversationRef(
  store: ConversationRefStore,
  context: TurnContext,
): void {
  const userId = context.activity.from?.id;
  if (!userId) return;
  store.set(userId, TurnContext.getConversationReference(context.activity));
}

/**
 * Send a proactive tone-warning card to the message author.
 * Silently skips if no conversation reference is available for the user.
 */
export async function sendToneWarning(
  adapter: BotFrameworkAdapter,
  store: ConversationRefStore,
  userId: string,
  originalText: string,
): Promise<void> {
  const ref = store.get(userId);
  if (!ref) return;

  await adapter.continueConversation(
    ref as ConversationReference,
    async (proactiveContext) => {
      const card = buildToneWarningCard(originalText);
      await proactiveContext.sendActivity(
        MessageFactory.attachment(CardFactory.adaptiveCard(card)),
      );
    },
  );
}

/**
 * Handle a rephrase-suggestion request submitted from the tone warning card.
 * Calls the Spann backend to simplify the text and sends suggestions back.
 */
export async function handleRephraseSuggestion(
  context: TurnContext,
  originalText: string,
  workspaceId: string,
): Promise<void> {
  const userId = context.activity.from?.id ?? '';
  const channelId = context.activity.conversation?.id ?? '';

  try {
    const processed = await spannApi.processMessage(
      originalText,
      userId,
      channelId,
      workspaceId,
    );

    await context.sendActivity(
      MessageFactory.text(
        `**Spann — suggested rephrase (Grade ${processed.reading_level} reading level):**\n\n` +
        `> ${processed.simplified}\n\n` +
        `*Feel free to copy, edit, and resend as fits your needs.*`,
      ),
    );
  } catch {
    await context.sendActivity(
      MessageFactory.text(
        '⚠️ Spann could not generate a rephrasing suggestion right now. The backend may be temporarily unavailable.',
      ),
    );
  }
}

/** Parse card submit data for settings save. */
export interface SaveSettingsData {
  verb: 'saveSettings';
  disabilityTypes?: string;
  readingLevel?: string;
  captionsEnabled?: string;
  toneAlerts?: string;
  simplifiedLanguage?: string;
}

/** Parse the Adaptive Card submit payload into typed profile inputs. */
export function parseSaveSettingsData(data: SaveSettingsData): {
  disabilityTypes: DisabilityType[];
  settings: ProfileSettings;
} {
  const disabilityTypes = (data.disabilityTypes ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as DisabilityType[];

  const readingLevel = Math.max(
    1,
    Math.min(12, parseInt(data.readingLevel ?? '8', 10) || 8),
  );

  return {
    disabilityTypes,
    settings: {
      cognitive: {
        simplifiedLanguage: data.simplifiedLanguage === 'true',
        targetReadingLevel: readingLevel,
      },
      deaf: {
        captionsEnabled: data.captionsEnabled === 'true',
        transcriptAutoGenerate: data.captionsEnabled === 'true',
      },
      anxiety: {
        toneAlerts: data.toneAlerts === 'true',
      },
    },
  };
}
