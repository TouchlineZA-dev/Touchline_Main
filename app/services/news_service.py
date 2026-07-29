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
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
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
    """Return a cached GNewsResponse if it exists and has not expired."""
    row = db.execute(
        text(
            """
            SELECT response
            FROM   app.news_cache
            WHERE  cache_key  = :key
              AND  expires_at > NOW()
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


def _set_cache(db: Session, cache_key: str, data: GNewsResponse) -> None:
    """Upsert a GNewsResponse into the cache with a TTL-based expiry."""
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.gnews_cache_ttl_minutes
    )
    db.execute(
        text(
            """
            INSERT INTO app.news_cache (cache_key, response, fetched_at, expires_at)
            VALUES (:key, CAST(:response AS JSONB), NOW(), :expires_at)
            ON CONFLICT (cache_key)
            DO UPDATE SET
                response   = EXCLUDED.response,
                fetched_at = NOW(),
                expires_at = EXCLUDED.expires_at
            """
        ),
        {
            "key": cache_key,
            "response": json.dumps(data.model_dump()),
            "expires_at": expires_at,
        },
    )
    db.commit()


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
        self._base = settings.gnews_base_url.rstrip("/")
        # Optional secondary provider (NewsAPI.ai)
        self._newsapi_base = settings.newsapi_ai_base_url.rstrip("/")
        self._newsapi_key = settings.newsapi_ai_api_key

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
        sync_job_id = _start_sync_job(db, "news") if db is not None else None

        try:
            _write_sync_log(db, sync_job_id, f"News sync started for {cache_key}") if db is not None else None

            # --- 1. Cache read ---
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
            _write_sync_log(
                db,
                sync_job_id,
                f"GNews returned {len(result.articles)} articles",
            ) if db is not None else None

            combined_articles: list[dict] = [a.model_dump() for a in result.articles]
            if self._newsapi_key:
                try:
                    other = await self._fetch_newsapi_ai(query, max_results)
                    combined_articles = _interleave_articles(combined_articles, other)
                    _write_sync_log(
                        db,
                        sync_job_id,
                        f"NewsAPI.ai returned {len(other)} articles",
                    ) if db is not None else None
                except Exception as exc:  # pragma: no cover - defensive
                    _write_sync_log(
                        db,
                        sync_job_id,
                        f"NewsAPI.ai fetch failed: {exc}",
                        "warning",
                    ) if db is not None else None
                    print(f"Warning: NewsAPI.ai fetch failed: {exc}")

            # Deduplicate by URL while preserving order
            seen: dict[str, dict] = {}
            for art in combined_articles:
                if not _is_sa_football_article(art):
                    continue
                url = (art.get("url") or "").strip()
                title_key = (art.get("title") or "").strip().lower()
                key = title_key or url.lower()
                if key and key not in seen:
                    # Ensure source is a plain dict with name/url
                    src = art.get("source") or {}
                    if not isinstance(src, dict):
                        src = {"name": str(src), "url": ""}
                    seen[key] = {
                        "title": art.get("title") or "",
                        "description": art.get("description"),
                        "content": art.get("content"),
                        "url": art.get("url") or "",
                        "image": art.get("image"),
                        "publishedAt": art.get("publishedAt") or art.get("published_at") or "",
                        "source": {"name": src.get("name") or "", "url": src.get("url") or ""},
                    }

            final_list = list(seen.values())[:max_results]
            final_response = GNewsResponse.model_validate({"totalArticles": len(final_list), "articles": final_list})

            # --- 3. Cache write ---
            if db is not None:
                _set_cache(db, cache_key, final_response)
                _write_sync_log(
                    db,
                    sync_job_id,
                    f"News sync completed; cached {len(final_response.articles)} articles",
                )
                _finish_sync_job(db, sync_job_id, "success")

            return final_response
        except Exception as exc:
            if db is not None:
                _write_sync_log(db, sync_job_id, f"News sync failed: {exc}", "error")
                _finish_sync_job(db, sync_job_id, "failed", str(exc))
            raise

    async def _fetch_newsapi_ai(self, query: str, max_results: int) -> list[dict]:
        """
        Fetch articles from NewsAPI.ai and return a list of article dicts compatible
        with the GNewsArticle schema (title, description, content, url, image, publishedAt, source).
        This method is defensive: any error results in an empty list.
        """
        if not self._newsapi_key:
            return []

        body = {
            "action": "getArticles",
            "keyword": _FOOTBALL_QUERY,
            "keywordSearchMode": "exact",
            "articlesSortBy": "date",
            "articlesSortByAsc": False,
            "articlesCount": max_results,
            "articlesPage": 1,
            "lang": "eng",
            "sourceLocationUri": "http://en.wikipedia.org/wiki/South_Africa",
            "dataType": ["news"],
            "forceMaxDataTimeWindow": 31,
            "resultType": "articles",
            "includeArticleImage": True,
            "includeArticleBody": True,
            "includeSourceTitle": True,
            "apiKey": self._newsapi_key,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(f"{self._newsapi_base}/article/getArticles", json=body)
            resp.raise_for_status()
            payload = resp.json()
            articles_payload = payload.get("articles") if isinstance(payload, dict) else None
            articles = articles_payload.get("results") if isinstance(articles_payload, dict) else articles_payload
            if not articles:
                return []

            normalized: list[dict] = []
            for item in articles[:max_results]:
                # Map common fields to GNews shape
                title = item.get("title") or item.get("headline") or ""
                description = item.get("description") or item.get("summary") or item.get("body", "")[:300] or None
                content = item.get("content") or item.get("body") or None
                url = item.get("url") or item.get("link") or ""
                image = item.get("image") or item.get("thumbnail") or item.get("imageUrl") or None
                published = item.get("publishedAt") or item.get("published_at") or item.get("dateTime") or item.get("date") or ""
                source = item.get("source")
                if isinstance(source, dict):
                    source_name = source.get("title") or source.get("name") or "NewsAPI.ai"
                    source_url = source.get("uri") or source.get("url") or ""
                else:
                    source_name = str(source) if source else "NewsAPI.ai"
                    source_url = ""

                normalized.append(
                    {
                        "title": title,
                        "description": description,
                        "content": content,
                        "url": url,
                        "image": image,
                        "publishedAt": published,
                        "source": {"name": source_name, "url": source_url},
                    }
                )

            return normalized
        except Exception:  # pragma: no cover - network/runtime dependent
            return []

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
