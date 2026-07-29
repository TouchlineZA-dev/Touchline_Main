"""Show the latest sync job and its log rows."""

from __future__ import annotations

from sqlalchemy import text

from sync_external_apis import load_dotenv, make_engine


def main() -> int:
    load_dotenv()
    engine = make_engine()
    with engine.begin() as conn:
        job = conn.execute(
            text(
                """
                SELECT id, started_at, completed_at, status, error_message
                FROM sync.sync_jobs
                ORDER BY id DESC
                LIMIT 1
                """
            )
        ).mappings().first()
        if not job:
            print("No sync jobs found.")
            return 0

        print(
            f"job id={job['id']} status={job['status']} "
            f"started={job['started_at']} completed={job['completed_at']}"
        )
        if job["error_message"]:
            print(f"error={job['error_message']}")

        rows = conn.execute(
            text(
                """
                SELECT level, logged_at, message
                FROM sync.sync_logs
                WHERE sync_job_id = :job_id
                ORDER BY id
                """
            ),
            {"job_id": job["id"]},
        ).mappings().all()
        for row in rows:
            print(f"[{row['level']}] {row['logged_at']}: {row['message']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
