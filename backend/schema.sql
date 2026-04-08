-- Spann authoritative base schema for fresh Postgres/Supabase bootstrap.
-- Apply once on a new environment.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Supabase compatibility shims for local Postgres environments.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb
);
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID AS $$
    SELECT NULL::uuid;
$$ LANGUAGE SQL STABLE;

-- 1) workspaces
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    initials VARCHAR(3) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#007AFF',
    locale VARCHAR(10) DEFAULT 'en-US',
    culture TEXT DEFAULT 'american',
    accessibility_prefs JSONB DEFAULT '{}'::jsonb,
    carbon_target FLOAT DEFAULT 10.0,
    coaching_opt_in BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Compatibility fields used by existing backend code paths.
    display_name TEXT,
    coaching_enabled BOOLEAN DEFAULT TRUE,
    accessibility_settings JSONB DEFAULT '{}'::jsonb
);

-- 3) workspace_members
CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (workspace_id, user_id)
);

-- 4) channels
CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Compatibility field for existing channel behavior.
    tone TEXT DEFAULT 'neutral',
    UNIQUE(workspace_id, name)
);

-- 5) messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 4096),
    text_translated TEXT,
    source_locale VARCHAR(10),
    sentiment_score FLOAT,
    mesh_origin BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Compatibility column used by older query paths.
    translated TEXT
);

-- 6) message_edits
CREATE TABLE IF NOT EXISTS message_edits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    previous_text TEXT NOT NULL,
    edited_at TIMESTAMPTZ DEFAULT NOW(),
    -- Compatibility fields used by edit history service.
    edited_by UUID,
    new_text TEXT
);

-- 7) message_reactions
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

-- 8) refresh_tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    device_hint TEXT
);

-- 9) mesh_nodes
CREATE TABLE IF NOT EXISTS mesh_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id TEXT NOT NULL UNIQUE,
    secret_hash TEXT NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ,
    revoked BOOLEAN DEFAULT FALSE
);

-- 10) carbon_logs
CREATE TABLE IF NOT EXISTS carbon_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    transport_type TEXT NOT NULL CHECK (transport_type IN ('car', 'bus', 'bike', 'remote', 'train', 'walk', 'flight')),
    kg_co2 FLOAT NOT NULL CHECK (kg_co2 >= 0.0 AND kg_co2 <= 500.0),
    logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
    logged_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, transport_type, logged_date),
    -- Compatibility fields used by leaderboard updates.
    score_delta INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11) pulse_snapshots
CREATE TABLE IF NOT EXISTS pulse_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    score FLOAT NOT NULL,
    label TEXT NOT NULL CHECK (label IN ('positive', 'neutral', 'stressed')),
    snapshot_minute TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', NOW()),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(channel_id, snapshot_minute),
    -- Compatibility unique key for upserts on channel_id.
    UNIQUE(channel_id)
);

-- Compatibility table for carbon leaderboard materialization.
CREATE TABLE IF NOT EXISTS carbon_scores (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    total_score INTEGER NOT NULL DEFAULT 0,
    total_kg_co2 FLOAT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (workspace_id, user_id)
);

-- Compatibility table for minute-level idempotency in sentiment tasks.
CREATE TABLE IF NOT EXISTS pulse_snapshot_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    minute_bucket TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(channel_id, minute_bucket)
);

CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_cursor ON messages(channel_id, id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_carbon_logs_user_date ON carbon_logs(user_id, logged_date);
CREATE INDEX IF NOT EXISTS idx_pulse_snapshots_channel ON pulse_snapshots(channel_id, snapshot_minute DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_mesh_nodes_node_id ON mesh_nodes(node_id);

-- Additional supporting indexes.
CREATE INDEX IF NOT EXISTS idx_carbon_scores_workspace ON carbon_scores(workspace_id, total_score DESC);
CREATE INDEX IF NOT EXISTS idx_mesh_nodes_workspace ON mesh_nodes(workspace_id);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesh_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE carbon_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulse_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE carbon_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulse_snapshot_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_read_own ON users;
CREATE POLICY users_read_own ON users
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS users_update_own ON users;
CREATE POLICY users_update_own ON users
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS members_read_same_workspace ON workspace_members;
CREATE POLICY members_read_same_workspace ON workspace_members
    FOR SELECT USING (
        workspace_id IN (
            SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS channels_read_workspace_member ON channels;
CREATE POLICY channels_read_workspace_member ON channels
    FOR SELECT USING (
        workspace_id IN (
            SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS messages_read_workspace_member ON messages;
CREATE POLICY messages_read_workspace_member ON messages
    FOR SELECT USING (
        workspace_id IN (
            SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS refresh_tokens_own ON refresh_tokens;
CREATE POLICY refresh_tokens_own ON refresh_tokens
    FOR ALL USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_name TEXT;
    user_initials TEXT;
BEGIN
    user_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
    user_initials := UPPER(
        LEFT(user_name, 1) ||
        COALESCE(NULLIF(LEFT(split_part(user_name, ' ', 2), 1), ''), LEFT(user_name, 2))
    );

    INSERT INTO public.users (id, email, name, initials, color, display_name)
    VALUES (
        NEW.id,
        NEW.email,
        user_name,
        LEFT(user_initials, 3),
        '#007AFF',
        user_name
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

INSERT INTO workspaces (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Spann Test Workspace', 'spann-test')
ON CONFLICT DO NOTHING;

COMMIT;
