"""Add workspace invitations and join request tables.

Revision ID: 20260410_0003
Revises: 20260409_0002
Create Date: 2026-04-10 08:55:00
"""

from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260410_0003"
down_revision = "20260409_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table if not exists workspace_invitations (
          id uuid primary key default gen_random_uuid(),
          workspace_id uuid not null references workspaces(id) on delete cascade,
          email text not null,
          invited_user_id uuid null references users(id) on delete set null,
          invited_by_user_id uuid not null references users(id) on delete cascade,
          status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'revoked')),
          note text null,
          created_at timestamptz not null default now(),
          responded_at timestamptz null,
          unique(workspace_id, email)
        );

        create index if not exists idx_workspace_invitations_workspace_status
          on workspace_invitations(workspace_id, status);

        create index if not exists idx_workspace_invitations_user_status
          on workspace_invitations(invited_user_id, status);

        create table if not exists workspace_join_requests (
          id uuid primary key default gen_random_uuid(),
          workspace_id uuid not null references workspaces(id) on delete cascade,
          requester_user_id uuid not null references users(id) on delete cascade,
          status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
          message text null,
          reviewed_by_user_id uuid null references users(id) on delete set null,
          created_at timestamptz not null default now(),
          reviewed_at timestamptz null,
          unique(workspace_id, requester_user_id)
        );

        create index if not exists idx_workspace_join_requests_workspace_status
          on workspace_join_requests(workspace_id, status);

        create index if not exists idx_workspace_join_requests_requester
          on workspace_join_requests(requester_user_id);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        drop table if exists workspace_join_requests;
        drop table if exists workspace_invitations;
        """
    )
