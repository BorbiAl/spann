/**
 * Spann FastAPI backend client.
 *
 * All Groq AI calls are made through the backend — the Slack app never calls
 * Groq directly.
 *
 * Workspace ID resolution
 * -----------------------
 * The FastAPI backend uses internal UUIDs for workspace IDs.  Slack events
 * carry only a team ID (e.g. "T1234567890").  This client lazily resolves
 * team IDs to workspace UUIDs via POST /api/workspaces/register (idempotent
 * upsert) and caches the result for the process lifetime.
 */

import { TTLCache } from '../cache/profileCache.js';
import {
  AccessibilityProfile,
  MessageProcessRequest,
  Platform,
  ProcessedMessage,
  ProfileSettings,
  ProfileUpsertRequest,
  SpannApiError,
  SummarizeThreadRequest,
  SummarizeThreadResponse,
  WorkspaceRegisterRequest,
  WorkspaceRegisterResponse,
  WorkspaceStats,
  type DisabilityType,
} from './types.js';

// Workspace UUID cache (team_id → internal UUID) — never expires for the
// lifetime of the process since workspace registrations don't change.
const workspaceIdCache = new Map<string, string>();

// Profile cache — 5 min TTL
const profileCache = new TTLCache<AccessibilityProfile | null>(5 * 60_000);

export class SpannApiClient {
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

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
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
        // ignore JSON parse failures
      }
      throw new SpannApiError(response.status, detail);
    }

    return response.json() as Promise<T>;
  }

  // ── Workspace ─────────────────────────────────────────────────────────────

  /**
   * Idempotent workspace registration.  Returns the internal workspace UUID.
   * Result is cached for the process lifetime.
   */
  async resolveWorkspaceId(
    teamId: string,
    teamName: string,
    billingEmail?: string,
  ): Promise<string> {
    const cached = workspaceIdCache.get(teamId);
    if (cached !== undefined) return cached;

    const payload: WorkspaceRegisterRequest = {
      platform: 'slack',
      platform_workspace_id: teamId,
      name: teamName,
      billing_email: billingEmail,
    };

    const { workspace } = await this.request<WorkspaceRegisterResponse>(
      'POST',
      '/api/workspaces/register',
      payload,
    );

    workspaceIdCache.set(teamId, workspace.id);
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
   * Returns null if no profile exists (404) rather than throwing.
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
          `?workspace_id=${encodeURIComponent(workspaceId)}&platform=slack`,
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

  /**
   * Create or update a user's accessibility profile.
   * Invalidates the cache entry for the user.
   */
  async upsertProfile(
    platformUserId: string,
    workspaceId: string,
    disabilityTypes: DisabilityType[],
    settings: ProfileSettings,
    displayName?: string,
    email?: string,
  ): Promise<AccessibilityProfile> {
    const payload: ProfileUpsertRequest = {
      platform: 'slack',
      workspace_id: workspaceId,
      display_name: displayName,
      email: email,
      disability_types: disabilityTypes,
      settings,
    };

    const profile = await this.request<AccessibilityProfile>(
      'POST',
      `/api/users/${encodeURIComponent(platformUserId)}/profile`,
      payload,
    );

    // Invalidate cache so next fetch reflects the new profile
    const cacheKey = `${workspaceId}:${platformUserId}`;
    profileCache.delete(cacheKey);

    return profile;
  }

  // ── Message Processing ────────────────────────────────────────────────────

  /**
   * Send a message through the Spann accessibility pipeline.
   * Returns within 800 ms (backend SLA).
   */
  async processMessage(
    rawText: string,
    authorId: string,
    channelId: string,
    workspaceId: string,
    threadId?: string,
  ): Promise<ProcessedMessage> {
    const payload: MessageProcessRequest = {
      platform_id: 'slack',
      channel_id: channelId,
      author_id: authorId,
      raw_text: rawText,
      workspace_id: workspaceId,
      thread_id: threadId,
    };

    return this.request<ProcessedMessage>('POST', '/api/messages/process', payload);
  }

  /**
   * Summarise a thread of messages.
   *
   * Requires `POST /api/messages/summarize-thread` on the FastAPI backend.
   * See backend/api/main.py for the endpoint implementation.
   */
  async summarizeThread(
    messages: Array<{ author_id: string; text: string }>,
    workspaceId: string,
  ): Promise<SummarizeThreadResponse> {
    const payload: SummarizeThreadRequest = {
      workspace_id: workspaceId,
      platform_id: 'slack',
      messages,
    };

    return this.request<SummarizeThreadResponse>(
      'POST',
      '/api/messages/summarize-thread',
      payload,
    );
  }
}

/** Singleton client — created once, reused across all handlers. */
export const spannApi = new SpannApiClient();
