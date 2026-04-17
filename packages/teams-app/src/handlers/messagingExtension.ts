/**
 * "Spann: Make Accessible" message action extension.
 *
 * Flow:
 *  1. User right-clicks a message → "Spann: Make Accessible"
 *  2. handleFetchTask() is called — processes the message through the backend
 *     and returns the accessibility breakdown card in a task module.
 *  3. User clicks "Insert accessible version as reply" → handleSubmitAction()
 *     returns a compose-extension result pre-filling the compose box.
 *  4. User clicks "Dismiss" → task module closes silently.
 *
 * Note: fetchTask is synchronous — Teams waits for the full response before
 * displaying the task module. Our backend SLA is 800 ms, well within Teams'
 * ~5 s timeout for fetchTask.
 */

import { CardFactory, TurnContext } from 'botbuilder';
import type { MessagingExtensionAction, MessagingExtensionActionResponse } from 'botbuilder';
import { spannApi } from '../api/client.js';
import {
  buildAccessibleMessageCard,
  buildErrorCard,
} from '../cards/accessibleMessageCard.js';

interface TeamsChannelData {
  tenant?: { id?: string };
  team?: { id?: string; name?: string };
  channel?: { id?: string };
}

interface SubmitData {
  verb?: string;
  text?: string;
  toneIndicator?: string;
  readingLevel?: number;
}

export async function handleFetchTask(
  context: TurnContext,
  action: MessagingExtensionAction,
  getWorkspaceId: (tenantId: string, teamName: string) => Promise<string>,
): Promise<MessagingExtensionActionResponse> {
  // Extract the message the user right-clicked
  const messageText = action.messagePayload?.body?.content ?? '';

  if (!messageText.trim()) {
    return taskContinue(
      'Spann: Make Accessible',
      500,
      600,
      buildErrorCard('This message has no text content to analyse.'),
    );
  }

  const userId = context.activity.from?.id ?? '';
  const cd = (context.activity.channelData ?? {}) as TeamsChannelData;
  const tenantId = cd.tenant?.id ?? '';
  const channelId =
    cd.channel?.id ?? context.activity.conversation?.id ?? '';
  const teamName = cd.team?.name ?? 'Microsoft Teams';

  try {
    const workspaceId = await getWorkspaceId(tenantId, teamName);

    const processed = await spannApi.processMessage(
      messageText,
      userId,
      channelId,
      workspaceId,
    );

    return taskContinue(
      'Spann: Make Accessible',
      620,
      720,
      buildAccessibleMessageCard(processed),
    );
  } catch (err) {
    const detail =
      err instanceof Error ? err.message : 'Unknown error from Spann backend.';

    return taskContinue(
      'Spann: Make Accessible',
      300,
      500,
      buildErrorCard(
        `Could not analyse this message. ${detail} ` +
        `Please check that the Spann backend is running at ${process.env['SPANN_API_URL'] ?? 'http://localhost:8001'}.`,
      ),
    );
  }
}

export async function handleSubmitAction(
  _context: TurnContext,
  action: MessagingExtensionAction,
): Promise<MessagingExtensionActionResponse> {
  const data = (action.data ?? {}) as SubmitData;

  if (data.verb === 'dismiss') {
    // Close the task module silently
    return {};
  }

  if (data.verb === 'insertAccessible' && data.text) {
    // Insert the accessible version as a new message in the compose box.
    // We use a Hero Card so the content is well-formatted and copyable.
    return {
      composeExtension: {
        type: 'result',
        attachmentLayout: 'list',
        attachments: [
          {
            ...CardFactory.heroCard(
              `Spann Accessible Version (Grade ${data.readingLevel ?? '?'} · ${data.toneIndicator ?? 'NEUTRAL'})`,
              data.text,
            ),
          },
        ],
      },
    };
  }

  return {};
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function taskContinue(
  title: string,
  height: number,
  width: number,
  card: object,
): MessagingExtensionActionResponse {
  return {
    task: {
      type: 'continue',
      value: {
        title,
        height,
        width,
        card: CardFactory.adaptiveCard(card),
      },
    },
  };
}
