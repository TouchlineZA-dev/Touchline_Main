"""
SAFootballNewsClient
--------------------
Runtime news reads are DB-only.

The public app should not call external providers. Separate sync workers are
responsible for filling app.news_cache from GNews/other providers. API requests
only read the latest cached Supabase/PostgreSQL rows and return an empty result
if the database has no news yet.
"""

import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas.news import GNewsResponse

# ---------------------------------------------------------------------------
# SA football context terms injected into every query
# ---------------------------------------------------------------------------
_SA_CONTEXT = "South Africa football"
_FOOTBALL_QUERY = (
    '"South Africa football" OR PSL OR "Premier Soccer League" OR '
    '"Betway Premiership" OR "Kaizer Chiefs" OR "Orlando Pirates" OR '
    '"Mamelodi Sundowns" OR "Bafana Bafana"'
)
_SA_FOOTBALL_TERMS = (
    "premier soccer league",
    "betway premiership",
    "dstv premiership",
    "kaizer chiefs",
    "orlando pirates",
    "mamelodi sundowns",
    "sundowns",
    "bafana bafana",
    "banyana banyana",
    "stellenbosch",
    "supersport united",
    "amazulu",
    "cape town city",
    "sekukhune",
    "chippa united",
    "richards bay",
    "golden arrows",
    "polokwane city",
    "ts galaxy",
)

def _build_query(user_query: str) -> str:
    """
    Append SA football context to any user-supplied query so results are
    always South African football.  Avoids duplicating the term if it is
    already present.
    """
    if _SA_CONTEXT.lower() in user_query.lower():
        return user_query
    return f"{user_query} {_SA_CONTEXT}"


def _interleave_articles(primary: list[dict], secondary: list[dict]) -> list[dict]:
    """Blend providers so the secondary provider is visible before slicing."""
    blended: list[dict] = []
    max_len = max(len(primary), len(secondary))
    for index in range(max_len):
        if index < len(primary):
            blended.append(primary[index])
        if index < len(secondary):
            blended.append(secondary[index])
    return blended


def _is_sa_football_article(article: dict) -> bool:
    text = " ".join(
        str(article.get(field) or "")
        for field in ("title", "description", "summary")
    ).lower()
    if any(term in text for term in _SA_FOOTBALL_TERMS):
        return True
    return "psl" in text.split() and ("football" in text or "soccer" in text)


# ---------------------------------------------------------------------------
# Cache helpers (uses the app.news_cache table via SQLAlchemy raw SQL)
# ---------------------------------------------------------------------------

def _get_cached(db: Session, cache_key: str) -> GNewsResponse | None:
    """Return the newest cached GNewsResponse for this key, even if stale."""
    row = db.execute(
        text(
            """
            SELECT response
            FROM   app.news_cache
            WHERE  cache_key  = :key
            ORDER BY fetched_at DESC
            LIMIT 1
            """
        ),
        {"key": cache_key},
    ).fetchone()

    if row is None:
        return None

    payload = row[0]
    if isinstance(payload, str):
        payload = json.loads(payload)
    return GNewsResponse.model_validate(payload)


def _start_sync_job(db: Session, job_type: str) -> int | None:
    """Create a sync job row, supporting databases before/after job_type exists."""
    try:
        row = db.execute(
            text(
                """
                INSERT INTO sync.sync_jobs (status, job_type)
                VALUES ('running', :job_type)
                RETURNING id
                """
            ),
            {"job_type": job_type},
        ).fetchone()
    except Exception:
        db.rollback()
        row = db.execute(
            text(
                """
                INSERT INTO sync.sync_jobs (status)
                VALUES ('running')
                RETURNING id
                """
            )
        ).fetchone()

    db.commit()
    return int(row[0]) if row else None


def _write_sync_log(db: Session, sync_job_id: int | None, message: str, level: str = "info") -> None:
    """Append a log line to sync.sync_logs when a job exists."""
    if sync_job_id is None:
        return

    try:
        db.execute(
            text(
                """
                INSERT INTO sync.sync_logs (sync_job_id, message, level)
                VALUES (:sync_job_id, :message, :level)
                """
            ),
            {"sync_job_id": sync_job_id, "message": message, "level": level},
        )
        db.commit()
    except Exception:
        db.rollback()


def _finish_sync_job(
    db: Session,
    sync_job_id: int | None,
    status: str,
    error_message: str | None = None,
) -> None:
    """Mark a sync job completed or failed."""
    if sync_job_id is None:
        return

    try:
        db.execute(
            text(
                """
                UPDATE sync.sync_jobs
                SET completed_at = NOW(),
                    status = :status,
                    error_message = :error_message
                WHERE id = :sync_job_id
                """
            ),
            {
                "sync_job_id": sync_job_id,
                "status": status,
                "error_message": error_message,
            },
        )
        db.commit()
    except Exception:
        db.rollback()


# ---------------------------------------------------------------------------
# GNews API client
# ---------------------------------------------------------------------------

class SAFootballNewsClient:
    """
    Async HTTP client for the GNews API, locked to South African football.

    All public methods accept an optional `db` (SQLAlchemy Session).
    When provided, results are read from / written to app.news_cache.
    When omitted the API is called directly without caching.
    """

    def __init__(self) -> None:
        pass

    async def _fetch(
        self,
        endpoint: str,
        query: str,
        max_results: int,
        cache_key: str,
        db: Session | None,
    ) -> GNewsResponse:
        """
        Core fetch method.
        Runtime reads are DB-only. External providers are only called by sync
        workers, never by user-facing API requests.
        """
        sync_job_id = _start_sync_job(db, "news") if db is not None else None

        try:
            _write_sync_log(db, sync_job_id, f"News DB read started for {cache_key}") if db is not None else None

            if db is not None:
                cached = _get_cached(db, cache_key)
                if cached is not None:
                    _write_sync_log(
                        db,
                        sync_job_id,
                        f"News cache hit for {cache_key}; returned {len(cached.articles)} articles",
                    )
                    _finish_sync_job(db, sync_job_id, "success")
                    return cached

            if db is not None:
                _write_sync_log(
                    db,
                    sync_job_id,
                    f"News DB read found no rows for {cache_key}",
                    "warning",
                )
                _finish_sync_job(db, sync_job_id, "success")

            return GNewsResponse.model_validate({"totalArticles": 0, "articles": []})
        except Exception as exc:
            if db is not None:
                _write_sync_log(db, sync_job_id, f"News DB read failed: {exc}", "error")
                _finish_sync_job(db, sync_job_id, "failed", str(exc))
            raise

    # ------------------------------------------------------------------
    # Public methods — one per news category
    # ------------------------------------------------------------------

    async def get_headlines(
        self,
        max_results: int = 10,
        db: Session | None = None,
    ) -> GNewsResponse:
        """Top SA football headlines (PSL, Bafana Bafana, general SA football)."""
        return await self._fetch(
            endpoint="search",
            query=_FOOTBALL_QUERY,
            max_results=max_results,
            cache_key=f"headlines:v2:{max_results}",
            db=db,
        )

    async def get_psl_news(
        self,
        max_results: int = 10,
        db: Session | None = None,
    ) -> GNewsResponse:
        """PSL — Premier Soccer League — specific news."""
        return await self._fetch(
            endpoint="search",
            query="PSL Premier Soccer League South Africa",
            max_results=max_results,
            cache_key=f"psl:v2:{max_results}",
            db=db,
        )

    async def get_bafana_news(
        self,
        max_results: int = 10,
        db: Session | None = None,
    ) -> GNewsResponse:
        """Bafana Bafana national team news."""
        return await self._fetch(
            endpoint="search",
            query="Bafana Bafana South Africa national team football",
            max_results=max_results,
            cache_key=f"bafana:v2:{max_results}",
            db=db,
        )

    async def search_news(
        self,
        query: str,
        max_results: int = 10,
        db: Session | None = None,
    ) -> GNewsResponse:
        """
        Free-text search scoped to SA football.
        e.g. query='Kaizer Chiefs' → 'Kaizer Chiefs South Africa football'
        """
        enriched = _build_query(query)
        safe_key = query.lower().replace(" ", "_")[:80]
        return await self._fetch(
            endpoint="search",
            query=enriched,
            max_results=max_results,
            cache_key=f"search:v2:{safe_key}:{max_results}",
            db=db,
        )

    async def get_team_news(
        self,
        team_name: str,
        max_results: int = 10,
        db: Session | None = None,
    ) -> GNewsResponse:
        """News for a specific South African club (e.g. 'Orlando Pirates')."""
        query = f"{team_name} PSL South Africa"
        safe_key = team_name.lower().replace(" ", "_")[:80]
        return await self._fetch(
            endpoint="search",
            query=query,
            max_results=max_results,
            cache_key=f"team:v2:{safe_key}:{max_results}",
            db=db,
        )

    async def get_player_news(
        self,
        player_name: str,
        max_results: int = 10,
        db: Session | None = None,
    ) -> GNewsResponse:
        """News for a specific South African footballer (e.g. 'Percy Tau')."""
        query = f"{player_name} South Africa football"
        safe_key = player_name.lower().replace(" ", "_")[:80]
        return await self._fetch(
            endpoint="search",
            query=query,
            max_results=max_results,
            cache_key=f"player:v2:{safe_key}:{max_results}",
            db=db,
        )


# Singleton instance — import and use directly in routers
sa_news_client = SAFootballNewsClient()
