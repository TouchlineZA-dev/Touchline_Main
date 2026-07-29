"""Mark the latest running sync job as failed."""

from __future__ import annotations

import argparse

from sqlalchemy import text

from sync_external_apis import load_dotenv, make_engine


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--message", default="Sync process stopped before completion.")
    args = parser.parse_args()

    load_dotenv()
    engine = make_engine()
    with engine.begin() as conn:
        job = conn.execute(
            text(
                """
                SELECT id
                FROM sync.sync_jobs
                WHERE status = 'running'
                ORDER BY id DESC
                LIMIT 1
                """
            )
        ).mappings().first()
        if not job:
            print("No running sync job found.")
            return 0

        conn.execute(
            text(
                """
                UPDATE sync.sync_jobs
                SET status = 'failed',
                    completed_at = NOW(),
                    error_message = :message
                WHERE id = :job_id
                """
            ),
            {"job_id": job["id"], "message": args.message},
        )
        conn.execute(
            text(
                """
                INSERT INTO sync.sync_logs(sync_job_id, level, message)
                VALUES (:job_id, 'error', :message)
                """
            ),
            {"job_id": job["id"], "message": args.message},
        )
        print(f"Marked sync job {job['id']} as failed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
