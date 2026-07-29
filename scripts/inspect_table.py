"""Print columns for a database table."""

from __future__ import annotations

import argparse

from sqlalchemy import text

from sync_external_apis import load_dotenv, make_engine


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("schema")
    parser.add_argument("table")
    args = parser.parse_args()

    load_dotenv()
    engine = make_engine()
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT column_name, is_nullable, column_default, data_type
                FROM information_schema.columns
                WHERE table_schema = :schema
                  AND table_name = :table
                ORDER BY ordinal_position
                """
            ),
            {"schema": args.schema, "table": args.table},
        ).all()

    for row in rows:
        print(row)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
