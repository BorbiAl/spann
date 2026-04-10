"""Add user onboarding profile fields.

Revision ID: 20260410_0004
Revises: 20260410_0003
Create Date: 2026-04-10 10:40:00
"""

from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260410_0004"
down_revision = "20260410_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        alter table users
          add column if not exists setup_platform text,
          add column if not exists setup_issues jsonb not null default '[]'::jsonb,
          add column if not exists setup_notes text,
          add column if not exists onboarding_completed boolean not null default false;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        alter table users
          drop column if exists onboarding_completed,
          drop column if exists setup_notes,
          drop column if exists setup_issues,
          drop column if exists setup_platform;
        """
    )
