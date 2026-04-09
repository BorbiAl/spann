"""Add workspace domain mapping table.

Revision ID: 20260409_0002
Revises: 20260409_0001
Create Date: 2026-04-09 21:40:00
"""

from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260409_0002"
down_revision = "20260409_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        create table if not exists workspace_domains (
          domain text primary key,
          workspace_id uuid not null references workspaces(id) on delete cascade,
          created_at timestamptz not null default now()
        );
        create index if not exists idx_workspace_domains_workspace on workspace_domains(workspace_id);
        """
    )


def downgrade() -> None:
    op.execute("drop table if exists workspace_domains;")
