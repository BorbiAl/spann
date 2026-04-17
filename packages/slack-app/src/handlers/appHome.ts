/**
 * App Home tab handler.
 *
 * Fires on `app_home_opened` when the user switches to the Home tab.
 * Fetches the user's accessibility profile and publishes the settings UI.
 */

import type { App } from '@slack/bolt';
import { spannApi } from '../api/client.js';
import { buildHomeView } from '../views/homeView.js';

export function registerAppHomeHandler(app: App, getWorkspaceId: (teamId: string) => Promise<string>): void {
  app.event('app_home_opened', async ({ event, client, context, logger }) => {
    // Only render the Home tab — not the Messages tab
    if (event.tab !== 'home') return;

    const userId = event.user;
    const teamId = context.teamId ?? '';

    try {
      const workspaceId = await getWorkspaceId(teamId);
      const profile = await spannApi.getProfile(userId, workspaceId);
      const view = buildHomeView(profile);

      await client.views.publish({ user_id: userId, view });
      logger.debug('app_home_published', { userId, hasProfile: profile !== null });
    } catch (err) {
      logger.error('app_home_error', { userId, teamId, error: err });

      // Publish a fallback view so the user doesn't see a blank screen
      await client.views.publish({
        user_id: userId,
        view: {
          type: 'home',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '⚠️  *Spann could not load your settings right now.*\n\nPlease try again in a moment. If this persists, contact your workspace admin.',
              },
            },
          ],
        },
      }).catch(() => {
        // Swallow secondary errors — we already logged the root cause
      });
    }
  });
}
