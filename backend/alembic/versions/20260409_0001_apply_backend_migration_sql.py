"""Apply backend migration.sql bootstrap schema.

Revision ID: 20260409_0001
Revises:
Create Date: 2026-04-09 18:30:00
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260409_0001"
down_revision = None
branch_labels = None
depends_on = None


def _migration_sql() -> str:
    """Load migration SQL and strip top-level transaction wrappers.

    Alembic controls the transaction boundary itself, so we remove only the
    top-level BEGIN/COMMIT lines from the checked-in SQL script.
    """

    backend_root = Path(__file__).resolve().parents[2]
    sql_path = backend_root / "migration.sql"
    raw = sql_path.read_text(encoding="utf-8")

    filtered_lines: list[str] = []
    for line in raw.splitlines():
        token = line.strip().lower()
        if token in {"begin;", "commit;"}:
            continue
        filtered_lines.append(line)

    return "\n".join(filtered_lines)


def upgrade() -> None:
    sql = _migration_sql()

    # Use the DBAPI cursor for multi-statement SQL (functions, indexes, etc.).
    raw_conn = op.get_bind().connection
    cursor = raw_conn.cursor()
    try:
        cursor.execute(sql)
    finally:
        cursor.close()


def downgrade() -> None:
    # Intentionally not destructive: this migration bootstraps shared tables.
    pass
