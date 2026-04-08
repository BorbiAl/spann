-- Spann backend hardening migration
-- Run before deploying updated backend service.

begin;

create extension if not exists pgcrypto;

-- Base schema bootstrap for local/test Postgres environments.
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz default now()
);

create table if not exists users (
  id uuid primary key,
  email text not null unique,
  name text not null,
  initials varchar(3) not null,
  color varchar(7) not null default '#007AFF',
  locale varchar(10) default 'en-US',
  culture text default 'american',
  accessibility_prefs jsonb default '{}'::jsonb,
  carbon_target double precision default 10.0,
  coaching_opt_in boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  display_name text,
  coaching_enabled boolean default true,
  accessibility_settings jsonb default '{}'::jsonb
);

create table if not exists workspace_members (
  workspace_id uuid not null,
  user_id uuid not null,
  role text not null check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
alter table workspace_members
  drop constraint if exists workspace_members_workspace_id_fkey;
alter table workspace_members
  drop constraint if exists workspace_members_user_id_fkey;
alter table workspace_members
  add constraint workspace_members_workspace_id_fkey
  foreign key (workspace_id) references workspaces(id) on delete cascade;
alter table workspace_members
  add constraint workspace_members_user_id_fkey
  foreign key (user_id) references users(id) on delete cascade;
create index if not exists idx_workspace_members_user on workspace_members(user_id);

create table if not exists channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text,
  is_private boolean default false,
  created_by uuid references users(id),
  created_at timestamptz default now(),
  tone text default 'neutral',
  unique(workspace_id, name)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 4096),
  text_translated text,
  source_locale varchar(10),
  sentiment_score double precision,
  mesh_origin boolean default false,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  translated text
);
create index if not exists idx_messages_channel_id on messages(channel_id);
create index if not exists idx_messages_created_at on messages(created_at desc);
create index if not exists idx_messages_cursor on messages(channel_id, id, created_at desc);

create table if not exists message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  emoji varchar(10) not null,
  created_at timestamptz default now(),
  unique(message_id, user_id, emoji)
);

create table if not exists pulse_snapshots (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  score double precision not null,
  label text not null check (label in ('positive', 'neutral', 'stressed')),
  snapshot_minute timestamptz not null default date_trunc('minute', now()),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(channel_id, snapshot_minute),
  unique(channel_id)
);
create index if not exists idx_pulse_snapshots_channel on pulse_snapshots(channel_id, snapshot_minute desc);

create table if not exists refresh_tokens (
  id uuid primary key,
  user_id uuid not null,
  token_hash text not null unique,
  workspace_id uuid not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked boolean not null default false,
  revoked_at timestamptz null,
  device_hint text null
);
alter table refresh_tokens
  drop constraint if exists refresh_tokens_user_id_fkey;
alter table refresh_tokens
  drop constraint if exists refresh_tokens_workspace_id_fkey;
alter table refresh_tokens
  add constraint refresh_tokens_user_id_fkey
  foreign key (user_id) references users(id) on delete cascade;
alter table refresh_tokens
  add constraint refresh_tokens_workspace_id_fkey
  foreign key (workspace_id) references workspaces(id) on delete cascade;
create index if not exists idx_refresh_tokens_user on refresh_tokens(user_id);
create index if not exists idx_refresh_tokens_expires on refresh_tokens(expires_at);
create index if not exists idx_refresh_tokens_user_revoked on refresh_tokens(user_id, revoked);

create or replace function rotate_refresh_token(
  p_old_token_hash text,
  p_new_token_hash text,
  p_user_id uuid,
  p_workspace_id uuid,
  p_expires_at timestamptz,
  p_device_hint text
) returns boolean
language plpgsql
as $$
declare
  v_updated integer;
begin
  update refresh_tokens
  set revoked = true,
      revoked_at = now()
  where token_hash = p_old_token_hash
    and user_id = p_user_id
    and workspace_id = p_workspace_id
    and revoked = false
    and expires_at > now();

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return false;
  end if;

  insert into refresh_tokens (
    id,
    user_id,
    token_hash,
    workspace_id,
    issued_at,
    expires_at,
    revoked,
    revoked_at,
    device_hint
  ) values (
    gen_random_uuid(),
    p_user_id,
    p_new_token_hash,
    p_workspace_id,
    now(),
    p_expires_at,
    false,
    null,
    p_device_hint
  );

  return true;
end;
$$;

create table if not exists mesh_nodes (
  id uuid primary key,
  node_id text not null unique,
  secret_hash text not null,
  workspace_id uuid not null,
  registered_at timestamptz not null default now(),
  last_seen timestamptz null,
  revoked boolean not null default false
);
alter table mesh_nodes
  drop constraint if exists mesh_nodes_workspace_id_fkey;
alter table mesh_nodes
  add constraint mesh_nodes_workspace_id_fkey
  foreign key (workspace_id) references workspaces(id) on delete cascade;
create index if not exists idx_mesh_nodes_workspace on mesh_nodes(workspace_id);

create table if not exists message_edits (
  id uuid primary key,
  message_id uuid not null,
  edited_by uuid not null,
  previous_text text not null,
  new_text text not null,
  edited_at timestamptz not null default now()
);
alter table message_edits
  drop constraint if exists message_edits_message_id_fkey;
alter table message_edits
  add constraint message_edits_message_id_fkey
  foreign key (message_id) references messages(id) on delete cascade;
create index if not exists idx_message_edits_message on message_edits(message_id);

create table if not exists pulse_snapshot_runs (
  id uuid primary key,
  channel_id uuid not null,
  minute_bucket timestamptz not null,
  created_at timestamptz not null default now(),
  unique(channel_id, minute_bucket)
);
alter table pulse_snapshot_runs
  drop constraint if exists pulse_snapshot_runs_channel_id_fkey;
alter table pulse_snapshot_runs
  add constraint pulse_snapshot_runs_channel_id_fkey
  foreign key (channel_id) references channels(id) on delete cascade;

create table if not exists carbon_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  transport_type text not null check (transport_type in ('car', 'bus', 'bike', 'remote', 'train', 'walk', 'flight')),
  kg_co2 double precision not null check (kg_co2 >= 0.0 and kg_co2 <= 500.0),
  logged_date date not null default current_date,
  logged_at timestamptz default now(),
  unique(user_id, transport_type, logged_date),
  score_delta integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_carbon_logs_user_date on carbon_logs(user_id, logged_date);

create table if not exists carbon_scores (
  user_id uuid not null references users(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  total_score integer not null default 0,
  total_kg_co2 double precision not null default 0,
  updated_at timestamptz default now(),
  primary key (workspace_id, user_id)
);
create index if not exists idx_carbon_scores_workspace on carbon_scores(workspace_id, total_score desc);

alter table if exists messages
  add column if not exists deleted_at timestamptz null,
  add column if not exists updated_at timestamptz null;

alter table if exists carbon_logs
  add column if not exists transport_type text,
  add column if not exists kg_co2 double precision,
  add column if not exists score_delta integer;

alter table if exists carbon_scores
  add column if not exists total_kg_co2 double precision not null default 0;

commit;
