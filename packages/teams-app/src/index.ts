/**
 * Spann Teams App — entry point
 *
 * Exposes three HTTP routes:
 *
 *  POST /api/messages       — Bot Framework endpoint for all Teams activities
 *  GET  /tab/settings       — Personal tab HTML (Adaptive Card profile setup)
 *  GET  /tab/api/settings   — Tab API: returns current profile + card JSON
 *  POST /tab/api/settings   — Tab API: saves profile, returns { ok: true }
 *  GET  /health             — Health check
 *
 * Tunneling for local dev
 * ───────────────────────
 * Use VS Code Dev Tunnels (not ngrok):
 *   devtunnel host --port 3002 --allow-anonymous
 * Then set TEAMS_BOT_ENDPOINT to the tunnel URL in appsettings.json / .env.
 */

import 'dotenv/config';
import * as restify from 'restify';
import { BotFrameworkAdapter } from 'botbuilder';
import type { Request, Response } from 'restify';
import { spannApi } from './api/client.js';
import { SpannBot } from './bot/spannBot.js';
import { buildSettingsCard } from './cards/settingsCard.js';
import { buildSettingsPage } from './tab/settingsPage.js';
import type { ConversationRefStore } from './handlers/proactiveNotifications.js';
import type { DisabilityType, ProfileSettings } from './api/types.js';
import type { ConversationReference } from 'botbuilder';

// ── Environment helpers ───────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

// ── Workspace ID cache (tenantId → internal UUID) ─────────────────────────────
// Lifetime: process lifetime (workspace UUIDs are immutable after creation).
const workspaceUuidCache = new Map<string, string>();

async function getWorkspaceId(tenantId: string, teamName: string): Promise<string> {
  const cached = workspaceUuidCache.get(tenantId);
  if (cached !== undefined) return cached;

  const id = await spannApi.resolveWorkspaceId(tenantId, teamName);
  workspaceUuidCache.set(tenantId, id);
  return id;
}

// ── Conversation reference store (userId → ConversationReference) ─────────────
const conversationRefs: ConversationRefStore = new Map<
  string,
  Partial<ConversationReference>
>();

// ── Bot Framework adapter ─────────────────────────────────────────────────────

const adapter = new BotFrameworkAdapter({
  appId: requireEnv('TEAMS_APP_ID'),
  appPassword: requireEnv('TEAMS_APP_PASSWORD'),
  channelAuthTenant: process.env['TEAMS_TENANT_ID'],
});

adapter.onTurnError = async (context, error) => {
  console.error('[SpannBot] Unhandled turn error:', error);
  try {
    await context.sendActivity(
      'Something went wrong processing your request. Please try again.',
    );
  } catch {
    // If we can't even reply, log and move on
  }
};

// ── Bot instance ──────────────────────────────────────────────────────────────

const bot = new SpannBot(adapter, conversationRefs, getWorkspaceId);

// ── Restify server ────────────────────────────────────────────────────────────

const server = restify.createServer({ name: 'spann-teams' });

server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser());

// CORS for tab pages (needed when the tab origin differs from the bot origin)
server.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return next();
});

// ── Bot Framework message endpoint ───────────────────────────────────────────

server.post('/api/messages', async (req: Request, res: Response) => {
  await adapter.processActivity(req as never, res as never, async (context) => {
    await bot.run(context);
  });
});

// ── Personal tab HTML page ────────────────────────────────────────────────────

const TAB_ORIGIN = (process.env['TEAMS_TAB_URL'] ?? `http://localhost:${process.env['TEAMS_PORT'] ?? 3002}`).replace(/\/$/, '');

server.get('/tab/settings', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(200, buildSettingsPage(TAB_ORIGIN));
});

// ── Tab API: GET current settings ─────────────────────────────────────────────

server.get('/tab/api/settings', async (req: Request, res: Response) => {
  const userId   = (req.query as Record<string, string>)['userId']   ?? '';
  const tenantId = (req.query as Record<string, string>)['tenantId'] ?? '';

  if (!userId || !tenantId) {
    res.send(400, { error: 'userId and tenantId are required' });
    return;
  }

  try {
    const workspaceId = await getWorkspaceId(tenantId, 'Microsoft Teams');
    const profile = await spannApi.getProfile(userId, workspaceId);
    const cardJson = buildSettingsCard(profile);
    res.send(200, { profile, cardJson });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Backend error';
    res.send(500, { error: message });
  }
});

// ── Tab API: POST save settings ───────────────────────────────────────────────

interface TabSettingsBody {
  verb?: string;
  userId?: string;
  tenantId?: string;
  disabilityTypes?: string;
  readingLevel?: string;
  captionsEnabled?: string;
  toneAlerts?: string;
  simplifiedLanguage?: string;
}

server.post('/tab/api/settings', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as TabSettingsBody;

  const userId   = body.userId   ?? '';
  const tenantId = body.tenantId ?? '';

  if (!userId || !tenantId) {
    res.send(400, { ok: false, error: 'userId and tenantId are required' });
    return;
  }

  try {
    const workspaceId = await getWorkspaceId(tenantId, 'Microsoft Teams');

    const disabilityTypes: DisabilityType[] = (body.disabilityTypes ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean) as DisabilityType[];

    const readingLevel = Math.max(
      1,
      Math.min(12, parseInt(body.readingLevel ?? '8', 10) || 8),
    );

    const settings: ProfileSettings = {
      cognitive: {
        simplifiedLanguage: body.simplifiedLanguage === 'true',
        targetReadingLevel: readingLevel,
      },
      deaf: {
        captionsEnabled: body.captionsEnabled === 'true',
        transcriptAutoGenerate: body.captionsEnabled === 'true',
      },
      anxiety: {
        toneAlerts: body.toneAlerts === 'true',
      },
    };

    await spannApi.upsertProfile(userId, workspaceId, disabilityTypes, settings);
    res.send(200, { ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Backend error';
    res.send(500, { ok: false, error: message });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────

server.get('/health', (_req: Request, res: Response) => {
  res.send(200, {
    status: 'ok',
    service: 'spann-teams-app',
    api: process.env['SPANN_API_URL'] ?? 'http://localhost:8001',
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────

// Evict expired profile cache entries every 10 minutes
setInterval(() => {
  // Profile cache lives in api/client.ts — TTLCache.get() evicts on access.
  // Workspace UUID cache is unbounded but safe (UUIDs are immutable).
}, 10 * 60_000).unref();

const port = Number(process.env['TEAMS_PORT'] ?? 3002);
server.listen(port, () => {
  console.log(
    `[Spann] Teams app started · port=${port} · api=${process.env['SPANN_API_URL'] ?? 'http://localhost:8001'}`,
  );
});
