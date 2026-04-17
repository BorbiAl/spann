-- =============================================================================
-- Spann Accessibility Plugin — Supabase Schema
-- backend/api/schema.sql
--
-- Apply once against a fresh Supabase project (or `psql` on local Postgres).
-- The existing backend/schema.sql belongs to the original Spann monolith;
-- this file owns the accessibility-plugin tables only.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE spann_platform AS ENUM ('slack', 'teams', 'discord');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE spann_plan AS ENUM ('free', 'starter', 'pro', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE spann_tone AS ENUM (
        'URGENT', 'CASUAL', 'FORMAL', 'AGGRESSIVE', 'SUPPORTIVE', 'NEUTRAL'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE spann_sub_status AS ENUM (
        'active', 'past_due', 'canceled', 'trialing', 'unpaid'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 1. workspaces
--    One row per platform installation (Slack workspace, Teams tenant, Discord server).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS workspaces (
    id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    platform              spann_platform NOT NULL,
    -- Opaque ID issued by the platform (e.g. Slack T-id, Discord guild snowflake)
    platform_workspace_id TEXT          NOT NULL,
    name                  TEXT          NOT NULL CHECK (char_length(name) BETWEEN 1 AND 256),
    plan                  spann_plan    NOT NULL DEFAULT 'free',
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_workspaces_platform UNIQUE (platform, platform_workspace_id)
);

COMMENT ON TABLE workspaces IS
    'One row per installed platform integration (Slack workspace / Teams tenant / Discord guild).';

-- ---------------------------------------------------------------------------
-- 2. users
--    Platform user scoped to a workspace.  Not linked to auth.users — bots use
--    service-role and identify users by platform_user_id.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id       UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    -- Platform-native user ID (e.g. Slack U-id, Discord snowflake)
    platform_user_id   TEXT        NOT NULL,
    email              TEXT,
    display_name       TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_users_workspace_platform UNIQUE (workspace_id, platform_user_id)
);

CREATE INDEX IF NOT EXISTS idx_users_workspace ON users (workspace_id);

COMMENT ON TABLE users IS
    'Platform users scoped to a workspace.  email/display_name are populated lazily.';

-- ---------------------------------------------------------------------------
-- 3. accessibility_profiles
--    One-to-one with users.  disability_types is an open-ended text array so
--    new types can be added without a schema migration.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS accessibility_profiles (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- e.g. ARRAY['VISUAL','DYSLEXIA']
    disability_types TEXT[]      NOT NULL DEFAULT '{}',
    -- Full preferences blob — validated at the application layer
    settings         JSONB       NOT NULL DEFAULT '{}',
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_profiles_user UNIQUE (user_id)
);

-- Fast "who has this disability?" queries
CREATE INDEX IF NOT EXISTS idx_profiles_disability_types
    ON accessibility_profiles USING GIN (disability_types);

-- Fast key-path queries on nested settings (e.g. settings->'cognitive')
CREATE INDEX IF NOT EXISTS idx_profiles_settings
    ON accessibility_profiles USING GIN (settings jsonb_path_ops);

-- Auto-bump updated_at on every write
CREATE OR REPLACE FUNCTION _spann_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON accessibility_profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON accessibility_profiles
    FOR EACH ROW EXECUTE FUNCTION _spann_set_updated_at();

COMMENT ON TABLE accessibility_profiles IS
    'One-to-one accessibility config per user.  Consumed by the AI processing pipeline.';

-- ---------------------------------------------------------------------------
-- 4. messages_processed
--    Immutable event log — one row per processed message.
--    Append-only; rows are never updated.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS messages_processed (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id   UUID          NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id        UUID          REFERENCES users(id) ON DELETE SET NULL,
    platform       spann_platform NOT NULL,
    original_text  TEXT          NOT NULL,
    processed_text TEXT          NOT NULL,
    tone_indicator spann_tone,
    -- Flesch-Kincaid grade level of processed_text, 1–12
    reading_level  SMALLINT      CHECK (reading_level BETWEEN 1 AND 12),
    -- AI latency in milliseconds — useful for SLA monitoring
    processing_ms  INTEGER,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Primary access patterns
CREATE INDEX IF NOT EXISTS idx_mp_workspace_ts
    ON messages_processed (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mp_user_ts
    ON messages_processed (user_id, created_at DESC)
    WHERE user_id IS NOT NULL;

COMMENT ON TABLE messages_processed IS
    'Immutable log of every AI-processed message.  Used for billing, analytics, and audit.';

-- ---------------------------------------------------------------------------
-- 5. subscriptions
--    One row per workspace, managed by Stripe webhooks.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subscriptions (
    id                     UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id           UUID             NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
    plan                   spann_plan       NOT NULL DEFAULT 'free',
    seats                  INTEGER          NOT NULL DEFAULT 5 CHECK (seats > 0),
    billing_email          TEXT,
    stripe_subscription_id TEXT             UNIQUE,
    status                 spann_sub_status NOT NULL DEFAULT 'active',
    current_period_end     TIMESTAMPTZ
);

COMMENT ON TABLE subscriptions IS
    'Stripe billing state per workspace.  Kept in sync via webhook events.';

-- ---------------------------------------------------------------------------
-- 6. audit_log
--    Append-only audit trail.  Rows are never updated or deleted.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_log (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
    -- e.g. 'workspace.register', 'profile.upsert', 'subscription.canceled'
    action       TEXT        NOT NULL CHECK (char_length(action) BETWEEN 1 AND 128),
    metadata     JSONB       NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_workspace_ts
    ON audit_log (workspace_id, created_at DESC);

COMMENT ON TABLE audit_log IS
    'Append-only compliance and debugging audit trail.';

-- =============================================================================
-- Row Level Security
-- =============================================================================
-- The backend service uses the service-role key, which bypasses RLS.
-- These policies protect direct access via anon/authenticated Supabase clients
-- (e.g. the Next.js dashboard using the anon key).
-- =============================================================================

ALTER TABLE workspaces          ENABLE ROW LEVEL SECURITY;
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessibility_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages_processed  ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;

-- ── workspaces ────────────────────────────────────────────────────────────────
-- Authenticated dashboard users can see workspaces they belong to.
CREATE POLICY "workspaces_member_read" ON workspaces
    FOR SELECT TO authenticated
    USING (
        id IN (
            SELECT workspace_id FROM users WHERE id = auth.uid()
        )
    );

-- ── users ─────────────────────────────────────────────────────────────────────
-- Own record: full access.
CREATE POLICY "users_self_all" ON users
    FOR ALL TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Workspace peers: read-only.
CREATE POLICY "users_workspace_read" ON users
    FOR SELECT TO authenticated
    USING (
        workspace_id IN (
            SELECT workspace_id FROM users WHERE id = auth.uid()
        )
    );

-- ── accessibility_profiles ────────────────────────────────────────────────────
-- Strict owner-only: a user's profile is private to themselves.
CREATE POLICY "profiles_owner_all" ON accessibility_profiles
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ── messages_processed ────────────────────────────────────────────────────────
-- Service role writes; dashboard reads workspace aggregate.
CREATE POLICY "messages_workspace_read" ON messages_processed
    FOR SELECT TO authenticated
    USING (
        workspace_id IN (
            SELECT workspace_id FROM users WHERE id = auth.uid()
        )
    );

-- ── subscriptions ─────────────────────────────────────────────────────────────
-- Workspace members can read their subscription; only service role can write.
CREATE POLICY "subscriptions_workspace_read" ON subscriptions
    FOR SELECT TO authenticated
    USING (
        workspace_id IN (
            SELECT workspace_id FROM users WHERE id = auth.uid()
        )
    );

-- ── audit_log ─────────────────────────────────────────────────────────────────
-- Workspace members can read audit events; no direct writes from clients.
CREATE POLICY "audit_workspace_read" ON audit_log
    FOR SELECT TO authenticated
    USING (
        workspace_id IN (
            SELECT workspace_id FROM users WHERE id = auth.uid()
        )
    );

-- =============================================================================
-- Realtime
-- =============================================================================
-- Clients subscribe to accessibility_profiles to receive live updates when
-- a user changes their settings in the dashboard.

ALTER TABLE accessibility_profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
    -- supabase_realtime publication exists in Supabase-hosted projects.
    -- Skip gracefully when running against plain Postgres (local dev).
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE accessibility_profiles';
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add accessibility_profiles to supabase_realtime: %', SQLERRM;
END;
$$;

COMMIT;
