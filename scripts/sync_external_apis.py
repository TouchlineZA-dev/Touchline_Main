"""
Fill Touchline database tables from external providers.

Sportsmonks is used for football data.
GNews is used only for football news cache data.

By default this script previews what it can fetch. Add --write to insert/update
rows in the database.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SPORTMONKS_BASE_URL = "https://api.sportmonks.com/v3/football"
DEFAULT_GNEWS_BASE_URL = "https://gnews.io/api/v4"


@dataclass
class SyncCounts:
    competitions: int = 0
    seasons: int = 0
    teams: int = 0
    fixtures: int = 0
    news_cache: int = 0


def load_dotenv() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def env(name: str, default: str | None = None) -> str | None:
    value = os.environ.get(name, default)
    if value is None:
        return None
    value = value.strip()
    return value or None


def parse_date(value: str | None) -> str | None:
    return value[:10] if value else None


def parse_datetime(value: str | None) -> str | None:
    return value.replace(" ", "T") if value else None


def as_bool(value: Any, default: bool = False) -> bool:
    return default if value is None else bool(value)


def make_engine() -> Engine:
    database_url = env("DATABASE_URL")
    if database_url is None:
        raise RuntimeError("DATABASE_URL is missing. Add it to .env or your shell environment.")
    return create_engine(database_url, pool_pre_ping=True)


class SportsmonksClient:
    def __init__(self) -> None:
        token = env("SPORTMONKS_API_KEY")
        if token is None:
            raise RuntimeError("SPORTMONKS_API_KEY is missing. Add it to .env or your shell environment.")
        self.token = token
        self.base_url = env("SPORTMONKS_BASE_URL", DEFAULT_SPORTMONKS_BASE_URL).rstrip("/")

    async def fetch_pages(
        self,
        client: httpx.AsyncClient,
        path: str,
        params: dict[str, Any] | None = None,
        max_pages: int = 5,
    ) -> list[dict[str, Any]]:
        merged_params = {"api_token": self.token, "per_page": 50}
        if params:
            merged_params.update(params)

        rows: list[dict[str, Any]] = []
        page = 1
        while page <= max_pages:
            merged_params["page"] = page
            response = await client.get(f"{self.base_url}/{path.lstrip('/')}", params=merged_params)
            response.raise_for_status()
            payload = response.json()
            data = payload.get("data", [])
            if isinstance(data, dict):
                data = [data]
            rows.extend(item for item in data if isinstance(item, dict))

            pagination = payload.get("pagination") or payload.get("meta", {}).get("pagination") or {}
            if not pagination.get("has_more"):
                break
            page += 1
        return rows


async def fetch_gnews(client: httpx.AsyncClient, max_results: int) -> dict[str, Any]:
    token = env("GNEWS_API_KEY")
    if token is None:
        raise RuntimeError("GNEWS_API_KEY is missing. Add it to .env or your shell environment.")

    base_url = env("GNEWS_BASE_URL", DEFAULT_GNEWS_BASE_URL).rstrip("/")
    response = await client.get(
        f"{base_url}/search",
        params={
            "token": token,
            "q": "South Africa football PSL",
            "country": "za",
            "lang": "en",
            "max": max_results,
        },
    )
    response.raise_for_status()
    return response.json()


def upsert_competition(engine: Engine, league: dict[str, Any]) -> int:
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                INSERT INTO football.competitions (
                    sportmonks_competition_id, name, short_code, country_id, type,
                    sub_type, active, image_path, category
                )
                VALUES (
                    :sportmonks_competition_id, :name, :short_code, :country_id, :type,
                    :sub_type, :active, :image_path, :category
                )
                ON CONFLICT (sportmonks_competition_id)
                DO UPDATE SET
                    name = EXCLUDED.name,
                    short_code = EXCLUDED.short_code,
                    country_id = EXCLUDED.country_id,
                    type = EXCLUDED.type,
                    sub_type = EXCLUDED.sub_type,
                    active = EXCLUDED.active,
                    image_path = EXCLUDED.image_path,
                    category = EXCLUDED.category
                RETURNING id
                """
            ),
            {
                "sportmonks_competition_id": league["id"],
                "name": league.get("name") or "Unknown league",
                "short_code": league.get("short_code"),
                "country_id": league.get("country_id"),
                "type": league.get("type"),
                "sub_type": league.get("sub_type"),
                "active": as_bool(league.get("active"), True),
                "image_path": league.get("image_path"),
                "category": league.get("category"),
            },
        ).one()
    return int(row.id)


def upsert_season(engine: Engine, season: dict[str, Any], competition_id: int) -> int:
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                INSERT INTO football.seasons (
                    sportmonks_season_id, competition_id, name, starting_at,
                    ending_at, is_current, finished, pending
                )
                VALUES (
                    :sportmonks_season_id, :competition_id, :name, :starting_at,
                    :ending_at, :is_current, :finished, :pending
                )
                ON CONFLICT (sportmonks_season_id)
                DO UPDATE SET
                    competition_id = EXCLUDED.competition_id,
                    name = EXCLUDED.name,
                    starting_at = EXCLUDED.starting_at,
                    ending_at = EXCLUDED.ending_at,
                    is_current = EXCLUDED.is_current,
                    finished = EXCLUDED.finished,
                    pending = EXCLUDED.pending
                RETURNING id
                """
            ),
            {
                "sportmonks_season_id": season["id"],
                "competition_id": competition_id,
                "name": season.get("name") or str(season["id"]),
                "starting_at": parse_date(season.get("starting_at")),
                "ending_at": parse_date(season.get("ending_at")),
                "is_current": as_bool(season.get("is_current")),
                "finished": as_bool(season.get("finished")),
                "pending": as_bool(season.get("pending")),
            },
        ).one()
    return int(row.id)


def upsert_teams(engine: Engine, teams: list[dict[str, Any]]) -> int:
    if not teams:
        return 0
    with engine.begin() as conn:
        for team in teams:
            conn.execute(
                text(
                    """
                    INSERT INTO football.teams (
                        sportmonks_team_id, name, short_code, country_id, venue_id,
                        founded, type, image_path, is_placeholder, last_played_at
                    )
                    VALUES (
                        :sportmonks_team_id, :name, :short_code, :country_id, :venue_id,
                        :founded, :type, :image_path, :is_placeholder, :last_played_at
                    )
                    ON CONFLICT (sportmonks_team_id)
                    DO UPDATE SET
                        name = EXCLUDED.name,
                        short_code = EXCLUDED.short_code,
                        country_id = EXCLUDED.country_id,
                        venue_id = EXCLUDED.venue_id,
                        founded = EXCLUDED.founded,
                        type = EXCLUDED.type,
                        image_path = EXCLUDED.image_path,
                        is_placeholder = EXCLUDED.is_placeholder,
                        last_played_at = EXCLUDED.last_played_at
                    """
                ),
                {
                    "sportmonks_team_id": team["id"],
                    "name": team.get("name") or "Unknown team",
                    "short_code": team.get("short_code"),
                    "country_id": team.get("country_id"),
                    "venue_id": team.get("venue_id"),
                    "founded": team.get("founded"),
                    "type": team.get("type"),
                    "image_path": team.get("image_path"),
                    "is_placeholder": as_bool(team.get("placeholder")),
                    "last_played_at": parse_datetime(team.get("last_played_at")),
                },
            )
    return len(teams)


def team_id_map(engine: Engine) -> dict[int, int]:
    with engine.begin() as conn:
        rows = conn.execute(text("SELECT id, sportmonks_team_id FROM football.teams")).all()
    return {int(row.sportmonks_team_id): int(row.id) for row in rows}


def upsert_fixtures(
    engine: Engine,
    fixtures: list[dict[str, Any]],
    competition_id: int,
    season_id: int,
) -> int:
    if not fixtures:
        return 0

    teams = team_id_map(engine)
    with engine.begin() as conn:
        for fixture in fixtures:
            participants = fixture.get("participants") or []
            home_team_id = None
            away_team_id = None
            if isinstance(participants, list):
                for participant in participants:
                    meta = participant.get("meta") or {}
                    local_id = teams.get(int(participant["id"])) if participant.get("id") else None
                    if meta.get("location") == "home":
                        home_team_id = local_id
                    elif meta.get("location") == "away":
                        away_team_id = local_id

            conn.execute(
                text(
                    """
                    INSERT INTO football.fixtures (
                        sportmonks_fixture_id, competition_id, season_id, stage_id,
                        aggregate_id, venue_id, state_id, home_team_id, away_team_id,
                        starting_at, result_info, leg, length, is_placeholder
                    )
                    VALUES (
                        :sportmonks_fixture_id, :competition_id, :season_id, :stage_id,
                        :aggregate_id, :venue_id, :state_id, :home_team_id, :away_team_id,
                        :starting_at, :result_info, :leg, :length, :is_placeholder
                    )
                    ON CONFLICT (sportmonks_fixture_id)
                    DO UPDATE SET
                        competition_id = EXCLUDED.competition_id,
                        season_id = EXCLUDED.season_id,
                        stage_id = EXCLUDED.stage_id,
                        aggregate_id = EXCLUDED.aggregate_id,
                        venue_id = EXCLUDED.venue_id,
                        state_id = EXCLUDED.state_id,
                        home_team_id = EXCLUDED.home_team_id,
                        away_team_id = EXCLUDED.away_team_id,
                        starting_at = EXCLUDED.starting_at,
                        result_info = EXCLUDED.result_info,
                        leg = EXCLUDED.leg,
                        length = EXCLUDED.length,
                        is_placeholder = EXCLUDED.is_placeholder
                    """
                ),
                {
                    "sportmonks_fixture_id": fixture["id"],
                    "competition_id": competition_id,
                    "season_id": season_id,
                    "stage_id": fixture.get("stage_id"),
                    "aggregate_id": fixture.get("aggregate_id"),
                    "venue_id": fixture.get("venue_id"),
                    "state_id": fixture.get("state_id"),
                    "home_team_id": home_team_id,
                    "away_team_id": away_team_id,
                    "starting_at": parse_datetime(fixture.get("starting_at")),
                    "result_info": fixture.get("result_info"),
                    "leg": fixture.get("leg"),
                    "length": fixture.get("length"),
                    "is_placeholder": as_bool(fixture.get("placeholder")),
                },
            )
    return len(fixtures)


def upsert_news_cache(engine: Engine, payload: dict[str, Any], max_results: int) -> int:
    ttl_minutes = int(env("GNEWS_CACHE_TTL_MINUTES", "30") or "30")
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO app.news_cache (cache_key, response, fetched_at, expires_at)
                VALUES (:cache_key, CAST(:response AS JSONB), NOW(), :expires_at)
                ON CONFLICT (cache_key)
                DO UPDATE SET
                    response = EXCLUDED.response,
                    fetched_at = NOW(),
                    expires_at = EXCLUDED.expires_at
                """
            ),
            {
                "cache_key": f"headlines:{max_results}",
                "response": json.dumps(payload),
                "expires_at": expires_at,
            },
        )
    return 1


def choose_league(leagues: list[dict[str, Any]], league_query: str) -> dict[str, Any]:
    if not leagues:
        raise RuntimeError(f"Sportsmonks returned no leagues for '{league_query}'.")
    south_african = [league for league in leagues if "south africa" in str(league).lower()]
    return south_african[0] if south_african else leagues[0]


def choose_season(seasons: list[dict[str, Any]], league_id: int) -> dict[str, Any]:
    scoped = [season for season in seasons if int(season.get("league_id") or 0) == league_id]
    if not scoped:
        raise RuntimeError(f"Sportsmonks returned no seasons for league id {league_id}.")
    current = [season for season in scoped if season.get("is_current")]
    if current:
        return current[0]
    return sorted(scoped, key=lambda row: row.get("starting_at") or "", reverse=True)[0]


async def sync_sportmonks(
    client: httpx.AsyncClient,
    api: SportsmonksClient,
    engine: Engine | None,
    write: bool,
    league_query: str,
    season_query: str,
    fixture_days_back: int,
    fixture_days_forward: int,
) -> SyncCounts:
    counts = SyncCounts()
    leagues = await api.fetch_pages(client, f"leagues/search/{quote(league_query)}", max_pages=1)
    league = choose_league(leagues, league_query)
    print(f"Sportsmonks league: {league.get('name')} (id {league.get('id')})")
    counts.competitions = 1

    seasons = await api.fetch_pages(
        client,
        f"seasons/search/{quote(season_query)}",
        params={"filters": f"seasonLeagues:{league['id']}"},
        max_pages=2,
    )
    season = choose_season(seasons, int(league["id"]))
    print(f"Sportsmonks season: {season.get('name')} (id {season.get('id')})")
    counts.seasons = 1

    teams = await api.fetch_pages(client, f"teams/seasons/{season['id']}", max_pages=2)
    print(f"Sportsmonks teams fetched: {len(teams)}")
    counts.teams = len(teams)

    today = datetime.now(timezone.utc).date()
    start_date = today - timedelta(days=fixture_days_back)
    end_date = today + timedelta(days=fixture_days_forward)
    fixtures = await api.fetch_pages(
        client,
        f"fixtures/between/{start_date.isoformat()}/{end_date.isoformat()}",
        params={
            "include": "participants",
            "filters": f"fixtureLeagues:{league['id']}",
        },
        max_pages=5,
    )
    print(f"Sportsmonks fixtures fetched: {len(fixtures)}")
    counts.fixtures = len(fixtures)

    if write:
        if engine is None:
            raise RuntimeError("Database engine was not created.")
        competition_db_id = upsert_competition(engine, league)
        season_db_id = upsert_season(engine, season, competition_db_id)
        counts.teams = upsert_teams(engine, teams)
        counts.fixtures = upsert_fixtures(engine, fixtures, competition_db_id, season_db_id)
    return counts


async def sync_gnews(
    client: httpx.AsyncClient,
    engine: Engine | None,
    write: bool,
    max_results: int,
) -> SyncCounts:
    counts = SyncCounts()
    payload = await fetch_gnews(client, max_results=max_results)
    articles = payload.get("articles") or []
    print(f"GNews articles fetched: {len(articles)}")
    counts.news_cache = 1 if articles else 0

    if write:
        if engine is None:
            raise RuntimeError("Database engine was not created.")
        counts.news_cache = upsert_news_cache(engine, payload, max_results=max_results)
    return counts


def print_counts(label: str, counts: SyncCounts) -> None:
    print(
        f"{label}: competitions={counts.competitions}, seasons={counts.seasons}, "
        f"teams={counts.teams}, fixtures={counts.fixtures}, news_cache={counts.news_cache}"
    )


async def main() -> int:
    parser = argparse.ArgumentParser(description="Fill Touchline tables from external APIs.")
    parser.add_argument("--provider", choices=("all", "sportmonks", "gnews"), default="all")
    parser.add_argument("--write", action="store_true", help="Write fetched data into the database.")
    parser.add_argument("--league-query", default="Premier Soccer League")
    parser.add_argument("--season-query", default="2025/2026")
    parser.add_argument("--fixture-days-back", type=int, default=30)
    parser.add_argument("--fixture-days-forward", type=int, default=30)
    parser.add_argument("--news-max", type=int, default=10)
    args = parser.parse_args()

    load_dotenv()
    engine = make_engine() if args.write else None

    timeout = httpx.Timeout(30.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        if args.provider in ("all", "sportmonks"):
            sportsmonks = SportsmonksClient()
            counts = await sync_sportmonks(
                client=client,
                api=sportsmonks,
                engine=engine,
                write=args.write,
                league_query=args.league_query,
                season_query=args.season_query,
                fixture_days_back=args.fixture_days_back,
                fixture_days_forward=args.fixture_days_forward,
            )
            print_counts("Sportsmonks", counts)

        if args.provider in ("all", "gnews"):
            counts = await sync_gnews(
                client=client,
                engine=engine,
                write=args.write,
                max_results=args.news_max,
            )
            print_counts("GNews", counts)

    if not args.write:
        print("Preview only. Run again with --write to fill the database.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
