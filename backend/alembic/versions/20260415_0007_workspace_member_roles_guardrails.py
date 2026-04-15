"""Harden workspace member role semantics for per-workspace ownership.

Revision ID: 20260415_0007
Revises: 20260415_0006
Create Date: 2026-04-15 11:10:00
"""

from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260415_0007"
down_revision = "20260415_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        -- Ensure the role column exists for older deployments.
        do $$
        begin
          if not exists (
            select 1
              from information_schema.columns
             where table_schema = 'public'
               and table_name = 'workspace_members'
               and column_name = 'role'
          ) then
            alter table workspace_members add column role text;
          end if;
        end
        $$;

        -- Normalize role values and set safe fallback.
        update workspace_members
           set role = 'member'
         where role is null
            or btrim(role) = '';

        update workspace_members
           set role = lower(btrim(role))
         where role is not null;

        update workspace_members
           set role = 'member'
         where role not in ('owner', 'admin', 'member');

        alter table workspace_members
          alter column role set default 'member';

        alter table workspace_members
          alter column role set not null;

        -- Replace loose/anonymous checks with explicit named check.
        alter table workspace_members
          drop constraint if exists workspace_members_role_check;

        alter table workspace_members
          drop constraint if exists ck_workspace_members_role_valid;

        alter table workspace_members
          add constraint ck_workspace_members_role_valid
          check (role in ('owner', 'admin', 'member'));

        -- Guarantee every workspace has at least one owner so role semantics are usable.
        with workspaces_missing_owner as (
          select wm.workspace_id
            from workspace_members wm
           group by wm.workspace_id
          having sum(case when wm.role = 'owner' then 1 else 0 end) = 0
        ),
        promote_candidates as (
          select distinct on (wm.workspace_id)
                 wm.workspace_id,
                 wm.user_id
            from workspace_members wm
            join workspaces_missing_owner missing
              on missing.workspace_id = wm.workspace_id
           order by wm.workspace_id,
                    coalesce(wm.joined_at, 'epoch'::timestamptz) asc,
                    wm.user_id asc
        )
        update workspace_members target
           set role = 'owner'
          from promote_candidates candidate
         where target.workspace_id = candidate.workspace_id
           and target.user_id = candidate.user_id;

        do $$
        begin
          perform pg_notify('pgrst', 'reload schema');
        exception when others then
          null;
        end
        $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        alter table workspace_members
          drop constraint if exists ck_workspace_members_role_valid;

        alter table workspace_members
          alter column role drop default;

        do $$
        begin
          perform pg_notify('pgrst', 'reload schema');
        exception when others then
          null;
        end
        $$;
        """
    )
