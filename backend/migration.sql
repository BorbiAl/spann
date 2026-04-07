-- Spann backend hardening migration
-- Run before deploying updated backend service.

begin;

create extension if not exists pgcrypto;

create table if not exists workspace_members (
  workspace_id uuid not null,
  user_id uuid not null,
  role text not null check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists idx_workspace_members_user on workspace_members(user_id);

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
create index if not exists idx_mesh_nodes_workspace on mesh_nodes(workspace_id);

create table if not exists message_edits (
  id uuid primary key,
  message_id uuid not null,
  edited_by uuid not null,
  previous_text text not null,
  new_text text not null,
  edited_at timestamptz not null default now()
);
create index if not exists idx_message_edits_message on message_edits(message_id);

create table if not exists pulse_snapshot_runs (
  id uuid primary key,
  channel_id uuid not null,
  minute_bucket timestamptz not null,
  created_at timestamptz not null default now(),
  unique(channel_id, minute_bucket)
);

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
