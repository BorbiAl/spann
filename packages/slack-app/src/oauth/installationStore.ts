/**
 * Supabase-backed Slack OAuth installation store.
 *
 * Stores bot tokens and maps Slack team IDs to Spann workspace UUIDs.
 * The service role key is required — this runs server-side only.
 *
 * ── Required Supabase table ──────────────────────────────────────────────────
 *
 *   CREATE TABLE IF NOT EXISTS slack_installations (
 *     id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
 *     team_id           TEXT        NOT NULL,
 *     enterprise_id     TEXT,
 *     workspace_id      UUID        REFERENCES workspaces(id),
 *     bot_token         TEXT        NOT NULL,
 *     bot_user_id       TEXT,
 *     bot_scopes        TEXT[]      DEFAULT '{}',
 *     user_token        TEXT,
 *     installed_at      TIMESTAMPTZ DEFAULT NOW(),
 *     CONSTRAINT uq_slack_installations_team
 *       UNIQUE (team_id, COALESCE(enterprise_id, ''))
 *   );
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import type { Installation, InstallationQuery, InstallationStore } from '@slack/oauth';
import { spannApi } from '../api/client.js';

function createSupabaseClient() {
  const url = process.env['SUPABASE_URL'] ?? '';
  const key = process.env['SUPABASE_SERVICE_KEY'] ?? process.env['SUPABASE_ANON_KEY'] ?? '';
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set for OAuth.');
  return createClient(url, key);
}

// Extended installation type — includes our internal workspace UUID
interface SpannInstallation extends Installation {
  metadata?: string; // JSON stringified { workspaceId: string }
}

function parseWorkspaceId(installation: SpannInstallation): string | undefined {
  try {
    const meta = JSON.parse(installation.metadata ?? '{}') as { workspaceId?: string };
    return meta.workspaceId;
  } catch {
    return undefined;
  }
}

export function createInstallationStore(): InstallationStore {
  const supabase = createSupabaseClient();

  return {
    // ── Store installation ─────────────────────────────────────────────────
    storeInstallation: async <AuthVersion extends 'v1' | 'v2'>(
      installation: Installation<AuthVersion, boolean>,
    ): Promise<void> => {
      const teamId = installation.team?.id ?? installation.enterprise?.id ?? '';
      const enterpriseId = installation.enterprise?.id ?? null;
      const teamName = installation.team?.name ?? installation.enterprise?.name ?? 'Unknown';

      // 1. Register workspace in Spann — idempotent upsert
      let workspaceId: string;
      try {
        workspaceId = await spannApi.resolveWorkspaceId(teamId, teamName);
      } catch (err) {
        console.error('[InstallationStore] workspace registration failed:', err);
        // Carry on — the token is still valuable to store
        workspaceId = '';
      }

      const row = {
        team_id: teamId,
        enterprise_id: enterpriseId,
        workspace_id: workspaceId || null,
        bot_token: installation.bot?.token ?? '',
        bot_user_id: installation.bot?.userId ?? null,
        bot_scopes: installation.bot?.scopes ?? [],
        user_token: installation.user.token ?? null,
      };

      const { error } = await supabase
        .from('slack_installations')
        .upsert(row, { onConflict: 'team_id,enterprise_id' });

      if (error) {
        throw new Error(`[InstallationStore] storeInstallation failed: ${error.message}`);
      }
    },

    // ── Fetch installation ─────────────────────────────────────────────────
    fetchInstallation: async <AuthVersion extends 'v1' | 'v2', IsEnterpriseInstall extends boolean>(
      query: InstallationQuery<IsEnterpriseInstall>,
    ): Promise<Installation<AuthVersion, IsEnterpriseInstall>> => {
      const teamId = query.teamId ?? query.enterpriseId ?? '';

      const { data, error } = await supabase
        .from('slack_installations')
        .select('*')
        .eq('team_id', teamId)
        .maybeSingle();

      if (error) {
        throw new Error(`[InstallationStore] fetchInstallation failed: ${error.message}`);
      }
      if (!data) {
        throw new Error(`[InstallationStore] No installation found for team ${teamId}`);
      }

      const workspaceId: string = data.workspace_id ?? '';

      // Build the Installation object expected by Bolt
      const installation: SpannInstallation = {
        team: query.isEnterpriseInstall
          ? undefined
          : { id: data.team_id as string, name: '' },
        enterprise: data.enterprise_id
          ? { id: data.enterprise_id as string, name: '' }
          : undefined,
        isEnterpriseInstall: query.isEnterpriseInstall,
        bot: {
          token: data.bot_token as string,
          userId: (data.bot_user_id ?? '') as string,
          scopes: (data.bot_scopes ?? []) as string[],
          id: '',
        },
        user: {
          token: (data.user_token ?? undefined) as string | undefined,
          id: '',
          scopes: undefined,
        },
        appId: process.env['SLACK_APP_ID'],
        tokenType: 'bot',
        // Embed our internal workspace UUID in metadata for handler access
        metadata: JSON.stringify({ workspaceId }),
      };

      return installation as Installation<AuthVersion, IsEnterpriseInstall>;
    },

    // ── Delete installation ────────────────────────────────────────────────
    deleteInstallation: async <IsEnterpriseInstall extends boolean>(
      query: InstallationQuery<IsEnterpriseInstall>,
    ): Promise<void> => {
      const teamId = query.teamId ?? query.enterpriseId ?? '';
      const { error } = await supabase
        .from('slack_installations')
        .delete()
        .eq('team_id', teamId);

      if (error) {
        throw new Error(`[InstallationStore] deleteInstallation failed: ${error.message}`);
      }
    },
  };
}

/**
 * Extract the Spann workspace UUID from an Installation's metadata field.
 * Returns an empty string if not present.
 */
export function workspaceIdFromInstallation(installation: Installation | null | undefined): string {
  if (!installation?.metadata) return '';
  try {
    const meta = JSON.parse(installation.metadata) as { workspaceId?: string };
    return meta.workspaceId ?? '';
  } catch {
    return '';
  }
}
