"""Apply the V027 full-sync database migration."""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import text

from sync_external_apis import load_dotenv, make_engine


ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "db" / "V027_full_sync_phases.sql"


def main() -> int:
    load_dotenv()
    engine = make_engine()
    sql = MIGRATION.read_text(encoding="utf-8")
    with engine.begin() as conn:
        conn.execute(text(sql))
    print(f"Applied {MIGRATION.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
