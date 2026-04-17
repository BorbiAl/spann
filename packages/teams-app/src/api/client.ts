/**
 * Spann FastAPI backend client — Teams edition.
 *
 * All AI calls go through the FastAPI backend; the Teams bot never calls
 * Groq directly.
 *
 * Workspace resolution
 * ────────────────────
 * Teams events carry an Azure AD tenant ID (e.g. "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx").
 * This client lazily resolves tenant IDs to Spann workspace UUIDs via
 * POST /api/workspaces/register (idempotent upsert) and caches the result
 * for the process lifetime.
 */

import { TTLCache } from '../cache/profileCache.js';
import type {
  AccessibilityProfile,
  DisabilityType,
  MessageProcessRequest,
  ProcessedMessage,
  ProfileSettings,
  ProfileUpsertRequest,
  SummarizeThreadRequest,
  SummarizeThreadResponse,
  WorkspaceRegisterRequest,
  WorkspaceRegisterResponse,
  WorkspaceStats,
} from './types.js';
import { SpannApiError } from './types.js';

const workspaceIdCache = new Map<string, string>();
const profileCache = new TTLCache<AccessibilityProfile | null>(5 * 60_000);

export class TeamsSpannApiClient {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(baseUrl?: string, timeoutMs = 5_000) {
    this.baseUrl = (baseUrl ?? process.env['SPANN_API_URL'] ?? 'http://localhost:8001').replace(
      /\/$/,
      '',
    );
    this.timeout = timeoutMs;
  }

  // ── Internal request helper ───────────────────────────────────────────────

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.timeout),
      });
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : String(cause);
      throw new SpannApiError(0, `Network error calling ${method} ${path}: ${msg}`);
    }

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const err = (await response.json()) as { detail?: string; message?: string };
        detail = err.detail ?? err.message ?? detail;
      } catch {
        // Ignore JSON parse failure — keep the generic status message
      }
      throw new SpannApiError(response.status, detail);
    }

    return response.json() as Promise<T>;
  }

  // ── Workspace ─────────────────────────────────────────────────────────────

  /**
   * Idempotent workspace registration.
   * `tenantId` is the Azure AD tenant GUID from Teams `channelData.tenant.id`.
   * Caches the result for the process lifetime.
   */
  async resolveWorkspaceId(tenantId: string, teamName: string): Promise<string> {
    const cached = workspaceIdCache.get(tenantId);
    if (cached !== undefined) return cached;

    const payload: WorkspaceRegisterRequest = {
      platform: 'teams',
      platform_workspace_id: tenantId,
      name: teamName,
    };

    const { workspace } = await this.request<WorkspaceRegisterResponse>(
      'POST',
      '/api/workspaces/register',
      payload,
    );

    workspaceIdCache.set(tenantId, workspace.id);
    return workspace.id;
  }

  async getWorkspaceStats(workspaceId: string): Promise<WorkspaceStats> {
    return this.request<WorkspaceStats>(
      'GET',
      `/api/workspaces/${encodeURIComponent(workspaceId)}/stats`,
    );
  }

  // ── Profiles ──────────────────────────────────────────────────────────────

  /**
   * Fetch a user's accessibility profile.
   * Returns null on 404 (user hasn't set up Spann yet).
   */
  async getProfile(
    platformUserId: string,
    workspaceId: string,
  ): Promise<AccessibilityProfile | null> {
    const cacheKey = `${workspaceId}:${platformUserId}`;
    const hit = profileCache.get(cacheKey);
    if (hit !== undefined) return hit;

    try {
      const profile = await this.request<AccessibilityProfile>(
        'GET',
        `/api/users/${encodeURIComponent(platformUserId)}/profile` +
          `?workspace_id=${encodeURIComponent(workspaceId)}&platform=teams`,
      );
      profileCache.set(cacheKey, profile);
      return profile;
    } catch (err) {
      if (err instanceof SpannApiError && err.statusCode === 404) {
        profileCache.set(cacheKey, null);
        return null;
      }
      throw err;
    }
  }

  /** Create or update a user's accessibility profile. Invalidates cache. */
  async upsertProfile(
    platformUserId: string,
    workspaceId: string,
    disabilityTypes: DisabilityType[],
    settings: ProfileSettings,
    displayName?: string,
    email?: string,
  ): Promise<AccessibilityProfile> {
    const payload: ProfileUpsertRequest = {
      platform: 'teams',
      workspace_id: workspaceId,
      disability_types: disabilityTypes,
      settings,
      ...(displayName !== undefined && { display_name: displayName }),
      ...(email !== undefined && { email }),
    };

    const profile = await this.request<AccessibilityProfile>(
      'POST',
      `/api/users/${encodeURIComponent(platformUserId)}/profile`,
      payload,
    );

    profileCache.delete(`${workspaceId}:${platformUserId}`);
    return profile;
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  /** Run a message through the Spann AI pipeline (simplify + tone). */
  async processMessage(
    rawText: string,
    authorId: string,
    channelId: string,
    workspaceId: string,
    threadId?: string,
  ): Promise<ProcessedMessage> {
    const payload: MessageProcessRequest = {
      platform_id: 'teams',
      channel_id: channelId,
      author_id: authorId,
      raw_text: rawText,
      workspace_id: workspaceId,
      ...(threadId !== undefined && { thread_id: threadId }),
    };

    return this.request<ProcessedMessage>('POST', '/api/messages/process', payload);
  }

  /** Summarise a thread of messages (e.g., for catch-up). */
  async summarizeThread(
    messages: Array<{ author_id: string; text: string }>,
    workspaceId: string,
  ): Promise<SummarizeThreadResponse> {
    const payload: SummarizeThreadRequest = {
      workspace_id: workspaceId,
      platform_id: 'teams',
      messages,
    };

    return this.request<SummarizeThreadResponse>(
      'POST',
      '/api/messages/summarize-thread',
      payload,
    );
  }
}

/** Singleton client — shared across all bot handlers. */
export const spannApi = new TeamsSpannApiClient();
