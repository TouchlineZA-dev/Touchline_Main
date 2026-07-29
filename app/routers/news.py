"""
News router — South African football news only.

All endpoints are powered by SAFootballNewsClient which hard-locks every
GNews request to country=za / lang=en and injects SA football context
into every query.

Endpoints
---------
GET /news/headlines          — general SA football headlines
GET /news/psl                — PSL / Premier Soccer League news
GET /news/bafana             — Bafana Bafana national team news
GET /news/search?q=...       — free-text search scoped to SA football
GET /news/team/{team_name}   — news for a specific SA club
GET /news/player/{player_name} — news for a specific SA footballer
"""

from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.news import GNewsResponse
from app.services.news_service import sa_news_client

router = APIRouter(prefix="/news", tags=["SA Football News"])

# Shared dependency type alias
DbDep = Annotated[Session | None, Depends(get_db)]

# Reusable max_results query param (1–10, free tier cap)
MaxDep = Annotated[
    int,
    Query(ge=1, le=10, description="Number of articles to return (max 10 on free tier)"),
]


def _handle_gnews_error(exc: httpx.HTTPStatusError) -> HTTPException:
    """Convert GNews HTTP errors into meaningful FastAPI responses."""
    if exc.response.status_code == 401:
        return HTTPException(status_code=502, detail="Invalid GNews API key.")
    if exc.response.status_code == 429:
        return HTTPException(
            status_code=429, detail="GNews daily quota exceeded. Try again tomorrow."
        )
    return HTTPException(
        status_code=502,
        detail=f"GNews API error: {exc.response.status_code}",
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/headlines",
    response_model=GNewsResponse,
    summary="SA Football Headlines",
    description=(
        "Returns the latest South African football headlines covering the PSL, "
        "Bafana Bafana, and general SA football. Results are cached for "
        "30 minutes to preserve API quota."
    ),
)
async def get_headlines(max: MaxDep = 10, db: DbDep = None) -> GNewsResponse:
    try:
        return await sa_news_client.get_headlines(max_results=max, db=db)
    except httpx.HTTPStatusError as exc:
        raise _handle_gnews_error(exc) from exc


@router.get(
    "/psl",
    response_model=GNewsResponse,
    summary="PSL News",
    description=(
        "Returns the latest Premier Soccer League (PSL) news from South African "
        "sources. Results are cached for 30 minutes."
    ),
)
async def get_psl_news(max: MaxDep = 10, db: DbDep = None) -> GNewsResponse:
    try:
        return await sa_news_client.get_psl_news(max_results=max, db=db)
    except httpx.HTTPStatusError as exc:
        raise _handle_gnews_error(exc) from exc


@router.get(
    "/bafana",
    response_model=GNewsResponse,
    summary="Bafana Bafana News",
    description=(
        "Returns the latest Bafana Bafana (South African national football team) news. "
        "Results are cached for 30 minutes."
    ),
)
async def get_bafana_news(max: MaxDep = 10, db: DbDep = None) -> GNewsResponse:
    try:
        return await sa_news_client.get_bafana_news(max_results=max, db=db)
    except httpx.HTTPStatusError as exc:
        raise _handle_gnews_error(exc) from exc


@router.get(
    "/search",
    response_model=GNewsResponse,
    summary="Search SA Football News",
    description=(
        "Free-text search scoped to South African football. "
        "Your query is automatically enriched with 'South Africa football' context "
        "so results are always SA-relevant. Example: `?q=Kaizer Chiefs`"
    ),
)
async def search_news(
    q: Annotated[str, Query(min_length=2, max_length=100, description="Search term, e.g. 'Kaizer Chiefs'")],
    max: MaxDep = 10,
    db: DbDep = None,
) -> GNewsResponse:
    try:
        return await sa_news_client.search_news(query=q, max_results=max, db=db)
    except httpx.HTTPStatusError as exc:
        raise _handle_gnews_error(exc) from exc


@router.get(
    "/team/{team_name}",
    response_model=GNewsResponse,
    summary="SA Club News",
    description=(
        "Returns news for a specific South African football club. "
        "Example: `/news/team/Orlando Pirates` or `/news/team/Kaizer Chiefs`. "
        "Results are cached per team name for 30 minutes."
    ),
)
async def get_team_news(
    team_name: str,
    max: MaxDep = 10,
    db: DbDep = None,
) -> GNewsResponse:
    try:
        return await sa_news_client.get_team_news(
            team_name=team_name, max_results=max, db=db
        )
    except httpx.HTTPStatusError as exc:
        raise _handle_gnews_error(exc) from exc


@router.get(
    "/player/{player_name}",
    response_model=GNewsResponse,
    summary="SA Player News",
    description=(
        "Returns news for a specific South African footballer. "
        "Example: `/news/player/Percy Tau` or `/news/player/Ronwen Williams`. "
        "Results are cached per player name for 30 minutes."
    ),
)
async def get_player_news(
    player_name: str,
    max: MaxDep = 10,
    db: DbDep = None,
) -> GNewsResponse:
    try:
        return await sa_news_client.get_player_news(
            player_name=player_name, max_results=max, db=db
        )
    except httpx.HTTPStatusError as exc:
        raise _handle_gnews_error(exc) from exc
