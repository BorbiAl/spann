/**
 * Spann Slack App — main entry point
 *
 * Modes
 * ─────
 * Socket Mode  (SLACK_SOCKET_MODE=true)   Local dev — no public URL needed.
 *                                          Requires SLACK_APP_TOKEN (xapp-…).
 *
 * HTTP Mode    (SLACK_SOCKET_MODE=false)  Production — Bolt handles OAuth
 *                                          install/callback routes automatically.
 *                                          Requires SLACK_CLIENT_ID + SLACK_CLIENT_SECRET
 *                                          + SLACK_STATE_SECRET and a public URL.
 *
 * Workspace ID resolution
 * ───────────────────────
 * Slack events carry a team_id (e.g. "T12345").  Our FastAPI backend uses
 * internal UUIDs.  `getWorkspaceId()` lazily calls POST /api/workspaces/register
 * (idempotent upsert) and caches the resulting UUID for the process lifetime.
 */

import 'dotenv/config';
import { App, type AppOptions } from '@slack/bolt';
import { TTLCache } from './cache/profileCache.js';
import { spannApi } from './api/client.js';
import { registerAppHomeHandler } from './handlers/appHome.js';
import { registerMessageHandler } from './handlers/messages.js';
import { registerCommandHandlers } from './handlers/commands.js';
import { registerShortcutHandlers } from './handlers/shortcuts.js';
import { registerActionHandlers } from './handlers/actions.js';
import { createInstallationStore } from './oauth/installationStore.js';

// ── Environment helpers ───────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function optionalEnv(key: string): string | undefined {
  return process.env[key] || undefined;
}

// ── Workspace ID cache (team_id → internal UUID) ──────────────────────────────
// Lifetime: process lifetime (never expires). Safe because workspace UUIDs
// are immutable after creation.
const workspaceUuidCache = new Map<string, string>();

async function getWorkspaceId(teamId: string): Promise<string> {
  const cached = workspaceUuidCache.get(teamId);
  if (cached !== undefined) return cached;

  // Resolve team name from Slack API (best-effort)
  let teamName = teamId;
  try {
    const info = await (app.client as typeof app.client & { team?: { info: (args: { team: string }) => Promise<{ team?: { name?: string } }> } }).team?.info({ team: teamId });
    teamName = info?.team?.name ?? teamId;
  } catch {
    // Non-fatal — use team_id as name
  }

  const workspaceId = await spannApi.resolveWorkspaceId(teamId, teamName);
  workspaceUuidCache.set(teamId, workspaceId);
  return workspaceId;
}

// ── App configuration ─────────────────────────────────────────────────────────

const socketMode = process.env['SLACK_SOCKET_MODE'] === 'true';
const port = Number(process.env['SLACK_PORT'] ?? 3001);

/** Required Slack OAuth scopes. */
const OAUTH_SCOPES: string[] = [
  'app_mentions:read',
  'channels:history',
  'channels:join',
  'channels:read',
  'chat:write',
  'chat:write.public',
  'commands',
  'files:read',
  'groups:history',
  'im:history',
  'im:write',
  'mpim:history',
  'team:read',
  'users:read',
  'users:read.email',
];

let appOptions: AppOptions;

if (socketMode) {
  // ── Socket Mode (development) ─────────────────────────────────────────────
  appOptions = {
    token: requireEnv('SLACK_BOT_TOKEN'),
    signingSecret: requireEnv('SLACK_SIGNING_SECRET'),
    socketMode: true,
    appToken: requireEnv('SLACK_APP_TOKEN'),
  };
} else {
  // ── HTTP Mode (production) with OAuth ────────────────────────────────────
  appOptions = {
    signingSecret: requireEnv('SLACK_SIGNING_SECRET'),
    clientId: requireEnv('SLACK_CLIENT_ID'),
    clientSecret: requireEnv('SLACK_CLIENT_SECRET'),
    stateSecret: requireEnv('SLACK_STATE_SECRET'),
    scopes: OAUTH_SCOPES,
    installationStore: createInstallationStore(),
    installerOptions: {
      // Slack will redirect to https://your-domain/slack/oauth_redirect
      redirectUriPath: '/slack/oauth_redirect',
      // Redirect users here after install
      callbackOptions: {
        success: (installation, _options, _req, res) => {
          res.send(
            `<html><body style="font-family:sans-serif;padding:2rem">` +
            `<h2>✅ Spann installed successfully!</h2>` +
            `<p>Open Slack and type <code>/spann-setup</code> to configure your accessibility profile.</p>` +
            `<p><a href="slack://open">Open Slack</a></p></body></html>`,
          );
        },
        failure: (_error, _options, _req, res) => {
          res.send(
            `<html><body style="font-family:sans-serif;padding:2rem">` +
            `<h2>❌ Installation failed</h2>` +
            `<p>Please try again or contact support.</p></body></html>`,
          );
        },
      },
    },
  };
}

export const app = new App(appOptions);

// ── Register all handlers ─────────────────────────────────────────────────────

registerAppHomeHandler(app, getWorkspaceId);
registerMessageHandler(app, getWorkspaceId);
registerCommandHandlers(app, getWorkspaceId);
registerShortcutHandlers(app, getWorkspaceId);
registerActionHandlers(app, getWorkspaceId);

// ── Health check route (HTTP mode only) ───────────────────────────────────────
if (!socketMode) {
  // @ts-expect-error — ExpressReceiver exposes .router
  const router = app.receiver?.router;
  if (router) {
    router.get('/health', (_req: unknown, res: { json: (body: unknown) => void }) => {
      res.json({ status: 'ok', service: 'spann-slack-app', socketMode: false });
    });
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

// Evict expired profile cache entries every 10 minutes
setInterval(() => {
  // The profile cache lives inside api/client.ts — eviction is handled by TTLCache.get()
  // This interval cleans up any workspace UUID entries (unbounded map — safe to skip for now)
}, 10 * 60_000).unref();

(async () => {
  await app.start(port);
  console.log(
    `[Spann] Slack app started` +
    ` · mode=${socketMode ? 'socket' : 'http'}` +
    ` · port=${socketMode ? 'n/a' : port}` +
    ` · api=${process.env['SPANN_API_URL'] ?? 'http://localhost:8001'}`,
  );
})();
