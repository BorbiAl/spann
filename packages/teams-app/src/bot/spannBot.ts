/**
 * SpannBot — main TeamsActivityHandler subclass.
 *
 * Registered handlers
 * ───────────────────
 *  onMessage           — message processing + Adaptive Card submit handling
 *  onMembersAdded      — welcome card on first install to personal scope
 *  handleTeamsMessagingExtensionFetchTask   — "Make Accessible" task module
 *  handleTeamsMessagingExtensionSubmitAction — task module submit
 */

import {
  BotFrameworkAdapter,
  CardFactory,
  MessageFactory,
  TeamsActivityHandler,
  TurnContext,
} from 'botbuilder';
import type { ConversationReference, MessagingExtensionAction, MessagingExtensionActionResponse } from 'botbuilder';
import { spannApi } from '../api/client.js';
import { buildSettingsCard } from '../cards/settingsCard.js';
import { handleMessageActivity } from '../handlers/messageHandler.js';
import { handleFetchTask, handleSubmitAction } from '../handlers/messagingExtension.js';
import {
  handleRephraseSuggestion,
  parseSaveSettingsData,
  type ConversationRefStore,
  type SaveSettingsData,
} from '../handlers/proactiveNotifications.js';

// ── Adaptive Card submit verbs ────────────────────────────────────────────────

interface CardActionData {
  verb?: string;
  [key: string]: unknown;
}

function isCardSubmit(activity: TurnContext['activity']): boolean {
  // Adaptive Card Action.Submit sends a message activity with value set
  return !activity.text && activity.value !== null && activity.value !== undefined;
}

// ── TeamsChannelData (minimal) ────────────────────────────────────────────────

interface TeamsChannelData {
  tenant?: { id?: string };
  team?: { name?: string };
}

export class SpannBot extends TeamsActivityHandler {
  constructor(
    private readonly adapter: BotFrameworkAdapter,
    private readonly conversationRefs: ConversationRefStore,
    private readonly getWorkspaceId: (tenantId: string, teamName: string) => Promise<string>,
  ) {
    super();

    // ── Incoming messages ────────────────────────────────────────────────────
    this.onMessage(async (context, next) => {
      if (isCardSubmit(context.activity)) {
        await this.handleCardSubmit(context);
      } else {
        await handleMessageActivity(
          context,
          this.adapter,
          this.conversationRefs,
          this.getWorkspaceId,
        );
      }
      await next();
    });

    // ── New member added to personal scope ───────────────────────────────────
    this.onMembersAdded(async (context, next) => {
      const added = context.activity.membersAdded ?? [];
      for (const member of added) {
        if (member.id !== context.activity.recipient.id) {
          await this.sendWelcomeCard(context).catch(() => {
            // Non-fatal — welcome card is best-effort
          });
        }
      }
      await next();
    });

    // ── Conversation update: store ref on any interaction ────────────────────
    this.onConversationUpdate(async (context, next) => {
      const userId = context.activity.from?.id;
      if (userId) {
        this.conversationRefs.set(
          userId,
          TurnContext.getConversationReference(context.activity) as Partial<ConversationReference>,
        );
      }
      await next();
    });
  }

  // ── Messaging extension — action: Make Accessible ─────────────────────────

  protected override async handleTeamsMessagingExtensionFetchTask(
    context: TurnContext,
    action: MessagingExtensionAction,
  ): Promise<MessagingExtensionActionResponse> {
    return handleFetchTask(context, action, this.getWorkspaceId);
  }

  protected override async handleTeamsMessagingExtensionSubmitAction(
    context: TurnContext,
    action: MessagingExtensionAction,
  ): Promise<MessagingExtensionActionResponse> {
    return handleSubmitAction(context, action);
  }

  // ── Adaptive Card submit from conversation messages ───────────────────────

  private async handleCardSubmit(context: TurnContext): Promise<void> {
    const data = (context.activity.value ?? {}) as CardActionData;
    const verb = data.verb;

    if (!verb) return;

    const cd = (context.activity.channelData ?? {}) as TeamsChannelData;
    const userId = context.activity.from?.id ?? '';
    const tenantId = cd.tenant?.id ?? '';
    const teamName = cd.team?.name ?? 'Microsoft Teams';

    let workspaceId = '';
    if (tenantId) {
      workspaceId = await this.getWorkspaceId(tenantId, teamName).catch(() => '');
    }

    if (verb === 'saveSettings') {
      await this.handleSaveSettings(context, data as unknown as SaveSettingsData, userId, workspaceId);
      return;
    }

    if (verb === 'rephraseSuggestion') {
      const originalText = (data['originalText'] as string | undefined) ?? '';
      if (originalText && workspaceId) {
        await handleRephraseSuggestion(context, originalText, workspaceId);
      }
      return;
    }

    // 'dismiss' and unknown verbs — no response needed
  }

  private async handleSaveSettings(
    context: TurnContext,
    data: SaveSettingsData,
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    if (!workspaceId) {
      await context.sendActivity(
        MessageFactory.text('⚠️ Could not save settings: workspace not resolved.'),
      );
      return;
    }

    try {
      const { disabilityTypes, settings } = parseSaveSettingsData(data);
      const displayName = context.activity.from?.name;

      await spannApi.upsertProfile(
        userId,
        workspaceId,
        disabilityTypes,
        settings,
        displayName,
      );

      // Show refreshed settings card
      const updated = await spannApi.getProfile(userId, workspaceId);
      await context.sendActivity(
        MessageFactory.attachment(CardFactory.adaptiveCard(buildSettingsCard(updated))),
      );
    } catch {
      await context.sendActivity(
        MessageFactory.text(
          '⚠️ Could not save your accessibility settings. Please try again or contact your workspace admin.',
        ),
      );
    }
  }

  private async sendWelcomeCard(context: TurnContext): Promise<void> {
    await context.sendActivity(
      MessageFactory.text(
        '👋 **Welcome to Spann!** I help make Teams more accessible for everyone. ' +
        'Select your accessibility needs below to get started.',
      ),
    );
    await context.sendActivity(
      MessageFactory.attachment(CardFactory.adaptiveCard(buildSettingsCard(null))),
    );
  }
}
