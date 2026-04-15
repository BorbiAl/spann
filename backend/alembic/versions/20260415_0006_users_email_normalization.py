"""Normalize users.email and add case-insensitive lookup index.

Revision ID: 20260415_0006
Revises: 20260410_0005
Create Date: 2026-04-15 09:30:00
"""

from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260415_0006"
down_revision = "20260410_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        -- Normalize non-conflicting emails to lower-case/trimmed values.
        update users as u
           set email = lower(trim(u.email))
         where u.email is not null
           and u.email <> lower(trim(u.email))
           and not exists (
             select 1
               from users as x
              where x.id <> u.id
                and lower(trim(x.email)) = lower(trim(u.email))
           );

        create or replace function normalize_users_email_before_write()
        returns trigger
        language plpgsql
        as $$
        begin
          if new.email is not null then
            new.email := lower(trim(new.email));
          end if;
          return new;
        end
        $$;

        drop trigger if exists trg_users_normalize_email on users;
        create trigger trg_users_normalize_email
          before insert or update of email on users
          for each row execute function normalize_users_email_before_write();

        create index if not exists idx_users_email_lower on users ((lower(email)));

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
        drop index if exists idx_users_email_lower;

        drop trigger if exists trg_users_normalize_email on users;
        drop function if exists normalize_users_email_before_write();

        do $$
        begin
          perform pg_notify('pgrst', 'reload schema');
        exception when others then
          null;
        end
        $$;
        """
    )
