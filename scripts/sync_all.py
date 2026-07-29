"""
Sync ALL 5 Sportsmonks leagues (all seasons) + GNews into the Touchline database.

Fixes:
- Chunks fixture date ranges into 28-day windows to avoid 422 errors
- Error handling per-season so one failure doesn't skip the rest
"""

from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime, date, timedelta, timezone
from pathlib import Path

import httpx
from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.sync_external_apis import (
    SportsmonksClient,
    load_dotenv,
    make_engine,
    upsert_competition,
    upsert_season,
    upsert_teams,
    upsert_fixtures,
    fetch_gnews,
    upsert_news_cache,
    print_counts,
    SyncCounts,
    env,
)

LEAGUES = [
    {"id": 806,  "name": "Premier League"},
    {"id": 1107, "name": "CAF Champions League"},
    {"id": 1378, "name": "Nedbank Cup"},
    {"id": 1413, "name": "MTN8 Cup"},
    {"id": 3004, "name": "Black Label Cup"},
]

CHUNK_DAYS = 28  # Max days per fixtures/between request


def date_chunks(start_str: str, end_str: str) -> list[tuple[str, str]]:
    """Break a date range into CHUNK_DAYS windows."""
    start = date.fromisoformat(start_str)
    end = date.fromisoformat(end_str)
    chunks = []
    while start < end:
        chunk_end = min(start + timedelta(days=CHUNK_DAYS), end)
        chunks.append((start.isoformat(), chunk_end.isoformat()))
        start = chunk_end + timedelta(days=1)
    return chunks


async def fetch_fixtures_chunked(
    client: httpx.AsyncClient,
    api: SportsmonksClient,
    league_id: int,
    start_date: str,
    end_date: str,
) -> list[dict]:
    """Fetch fixtures in small date-range chunks to avoid 422 errors."""
    all_fixtures = []
    chunks = date_chunks(start_date, end_date)
    for chunk_start, chunk_end in chunks:
        try:
            fixtures = await api.fetch_pages(
                client,
                f"fixtures/between/{chunk_start}/{chunk_end}",
                params={
                    "include": "participants",
                    "filters": f"fixtureLeagues:{league_id}",
                },
                max_pages=5,
            )
            all_fixtures.extend(fixtures)
        except httpx.HTTPStatusError as e:
            print(f"      WARNING: Fixtures chunk {chunk_start} to {chunk_end} failed: {e.response.status_code}")
    return all_fixtures


async def sync_league(
    client: httpx.AsyncClient,
    api: SportsmonksClient,
    engine,
    league_info: dict,
) -> SyncCounts:
    counts = SyncCounts()
    league_id = league_info["id"]

    # Fetch league details
    leagues = await api.fetch_pages(client, f"leagues/{league_id}", max_pages=1)
    league = leagues[0] if leagues else {"id": league_id, "name": league_info["name"]}
    print(f"  League: {league.get('name')} (id {league.get('id')})")

    competition_db_id = upsert_competition(engine, league)
    counts.competitions = 1

    # Fetch all seasons
    seasons_data = await api.fetch_pages(
        client, "seasons",
        params={"filters": f"seasonLeagues:{league_id}"},
        max_pages=3,
    )
    if not seasons_data:
        print(f"  WARNING: No seasons found, skipping.")
        return counts

    print(f"  Seasons available: {len(seasons_data)}")

    for season in seasons_data:
        s_name = season.get("name")
        s_id = season["id"]
        print(f"\n  --- Season: {s_name} (id {s_id}, current={season.get('is_current')}) ---")

        try:
            season_db_id = upsert_season(engine, season, competition_db_id)
            counts.seasons += 1

            # Teams
            teams = await api.fetch_pages(client, f"teams/seasons/{s_id}", max_pages=3)
            print(f"    Teams fetched: {len(teams)}")
            counts.teams += upsert_teams(engine, teams)

            # Fixtures (chunked)
            start = (season.get("starting_at") or "")[:10]
            end = (season.get("ending_at") or "")[:10]
            if start and end:
                fixtures = await fetch_fixtures_chunked(client, api, league_id, start, end)
                print(f"    Fixtures fetched: {len(fixtures)}")
                counts.fixtures += upsert_fixtures(engine, fixtures, competition_db_id, season_db_id)
            else:
                print(f"    Skipping fixtures (no date range)")

        except Exception as e:
            print(f"    ERROR on season {s_name}: {e}")

    return counts


async def main() -> int:
    load_dotenv()
    engine = make_engine()
    api = SportsmonksClient()
    timeout = httpx.Timeout(30.0)

    total = SyncCounts()

    async with httpx.AsyncClient(timeout=timeout) as client:
        for league_info in LEAGUES:
            print(f"\n{'='*60}")
            print(f"Syncing: {league_info['name']} (id {league_info['id']})")
            print(f"{'='*60}")
            try:
                counts = await sync_league(client, api, engine, league_info)
                print_counts(f"\n  Subtotal", counts)
                total.competitions += counts.competitions
                total.seasons += counts.seasons
                total.teams += counts.teams
                total.fixtures += counts.fixtures
            except Exception as e:
                print(f"  FATAL ERROR: {e}")

        # GNews
        print(f"\n{'='*60}")
        print("Syncing: GNews")
        print(f"{'='*60}")
        try:
            payload = await fetch_gnews(client, max_results=10)
            articles = payload.get("articles") or []
            print(f"  Articles fetched: {len(articles)}")
            total.news_cache = upsert_news_cache(engine, payload, max_results=10)
        except Exception as e:
            print(f"  ERROR: {e}")

    print(f"\n{'='*60}")
    print_counts("GRAND TOTAL", total)
    print(f"{'='*60}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
