"""
SAFootballNewsClient
--------------------
Wraps the GNews API and is strictly scoped to South African football.

Every request is hardcoded with:
  - country = za
  - lang    = en

Query strings are automatically enriched with SA football context so that
callers can never accidentally retrieve non-SA or non-football content.

Results are cached in app.news_cache (Supabase / PostgreSQL) for
`settings.gnews_cache_ttl_minutes` minutes to preserve the daily API quota.
"""

import json
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.schemas.news import GNewsResponse

# ---------------------------------------------------------------------------
# SA football context terms injected into every query
# ---------------------------------------------------------------------------
_SA_CONTEXT = "South Africa football"

_FIXED_PARAMS = {
    "country": "za",
    "lang": "en",
    "token": settings.gnews_api_key,
}


def _build_query(user_query: str) -> str:
    """
    Append SA football context to any user-supplied query so results are
    always South African football.  Avoids duplicating the term if it is
    already present.
    """
    if _SA_CONTEXT.lower() in user_query.lower():
        return user_query
    return f"{user_query} {_SA_CONTEXT}"


# ---------------------------------------------------------------------------
# Cache helpers (uses the app.news_cache table via SQLAlchemy raw SQL)
# ---------------------------------------------------------------------------

def _get_cached(db: Session, cache_key: str) -> GNewsResponse | None:
    """Return a cached GNewsResponse if it exists and has not expired."""
    row = db.execute(
        """
        SELECT response
        FROM   app.news_cache
        WHERE  cache_key  = :key
          AND  expires_at > NOW()
        LIMIT 1
        """,
        {"key": cache_key},
    ).fetchone()

    if row is None:
        return None

    return GNewsResponse.model_validate(row[0])


def _set_cache(db: Session, cache_key: str, data: GNewsResponse) -> None:
    """Upsert a GNewsResponse into the cache with a TTL-based expiry."""
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.gnews_cache_ttl_minutes
    )
    db.execute(
        """
        INSERT INTO app.news_cache (cache_key, response, fetched_at, expires_at)
        VALUES (:key, :response, NOW(), :expires_at)
        ON CONFLICT (cache_key)
        DO UPDATE SET
            response   = EXCLUDED.response,
            fetched_at = NOW(),
            expires_at = EXCLUDED.expires_at
        """,
        {
            "key": cache_key,
            "response": json.dumps(data.model_dump()),
            "expires_at": expires_at,
        },
    )
    db.commit()


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
        self._base = settings.gnews_base_url.rstrip("/")

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
        1. Check cache (if db supplied).
        2. Call GNews API.
        3. Write result to cache.
        4. Return validated GNewsResponse.
        """
        # --- 1. Cache read ---
        if db is not None:
            cached = _get_cached(db, cache_key)
            if cached is not None:
                return cached

        # --- 2. Live API call ---
        params = {
            **_FIXED_PARAMS,
            "q": query,
            "max": max_results,
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{self._base}/{endpoint}", params=params)

        response.raise_for_status()
        result = GNewsResponse.model_validate(response.json())

        # --- 3. Cache write ---
        if db is not None:
            _set_cache(db, cache_key, result)

        return result

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
            query="South Africa football PSL",
            max_results=max_results,
            cache_key=f"headlines:{max_results}",
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
            cache_key=f"psl:{max_results}",
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
            cache_key=f"bafana:{max_results}",
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
            cache_key=f"search:{safe_key}:{max_results}",
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
            cache_key=f"team:{safe_key}:{max_results}",
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
            cache_key=f"player:{safe_key}:{max_results}",
            db=db,
        )


# Singleton instance — import and use directly in routers
sa_news_client = SAFootballNewsClient()
