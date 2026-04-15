"""Add missing users profile columns used by API.

Revision ID: 20260410_0005
Revises: 20260410_0004
Create Date: 2026-04-10 16:36:00
"""

from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260410_0005"
down_revision = "20260410_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        alter table users
          add column if not exists username text,
          add column if not exists bio text,
          add column if not exists timezone text,
          add column if not exists role text not null default 'member',
          add column if not exists avatar_url text;

        update users
           set username = coalesce(nullif(username, ''), split_part(lower(email), '@', 1))
         where username is null or username = '';

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
        alter table users
          drop column if exists avatar_url,
          drop column if exists role,
          drop column if exists timezone,
          drop column if exists bio,
          drop column if exists username;
        """
    )
