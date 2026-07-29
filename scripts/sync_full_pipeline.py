"""
Run the Touchline football data pipeline.

Phases covered:
1. Core football data: competitions, seasons, teams, fixtures, scores.
2. Players and initial prices.
3. Standings.
4. Recent match details: lineups, events, statistics.
5. Fantasy points.
6. Leaderboards.
7. GNews cache.
8. Sync job logging.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import zlib
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SPORTMONKS_BASE_URL = "https://api.sportmonks.com/v3/football"
DEFAULT_GNEWS_BASE_URL = "https://gnews.io/api/v4"
# League IDs already proven against this project's Sportsmonks subscription.
DEFAULT_LEAGUES = "806,1107,1378,1413,3004"
FIXTURE_CHUNK_DAYS = 28


@dataclass
class SyncCounts:
    competitions: int = 0
    seasons: int = 0
    teams: int = 0
    fixtures: int = 0
    players: int = 0
    player_prices: int = 0
    standings: int = 0
    lineups: int = 0
    events: int = 0
    statistics: int = 0
    points_results: int = 0
    leaderboards: int = 0
    news_cache: int = 0

    def add(self, other: "SyncCounts") -> None:
        for field in self.__dataclass_fields__:
            setattr(self, field, getattr(self, field) + getattr(other, field))


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


def parse_date(value: Any) -> str | None:
    if not value:
        return None
    return str(value)[:10]


def parse_datetime(value: Any) -> str | None:
    if not value:
        return None
    return str(value).replace(" ", "T")


def as_bool(value: Any, default: bool = False) -> bool:
    return default if value is None else bool(value)


def as_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def stable_id(*parts: Any) -> int:
    raw = ":".join("" if part is None else str(part) for part in parts)
    return zlib.crc32(raw.encode("utf-8")) & 0x7FFFFFFF


def json_dumps(value: Any) -> str:
    return json.dumps(value, separators=(",", ":"), default=str)


def make_engine() -> Engine:
    database_url = env("DATABASE_URL")
    if database_url is None:
        raise RuntimeError("DATABASE_URL is missing. Add it to .env or your shell environment.")
    return create_engine(database_url, pool_pre_ping=True)


class SyncLogger:
    def __init__(self, engine: Engine | None, write: bool) -> None:
        self.engine = engine
        self.write = write
        self.job_id: int | None = None

    def start(self) -> None:
        if not self.write or self.engine is None:
            print("sync job: preview")
            return
        with self.engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    INSERT INTO sync.sync_jobs(status, job_type)
                    VALUES ('running', 'full_pipeline')
                    RETURNING id
                    """
                )
            ).one()
            self.job_id = int(row.id)
        self.log("Sync job started.")

    def log(self, message: str, level: str = "info") -> None:
        print(f"[{level}] {message}")
        if not self.write or self.engine is None or self.job_id is None:
            return
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO sync.sync_logs(sync_job_id, message, level)
                    VALUES (:sync_job_id, :message, :level)
                    """
                ),
                {"sync_job_id": self.job_id, "message": message, "level": level},
            )

    def complete(self, status: str, error_message: str | None = None) -> None:
        if not self.write or self.engine is None or self.job_id is None:
            return
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    UPDATE sync.sync_jobs
                    SET status = :status, completed_at = NOW(), error_message = :error_message
                    WHERE id = :job_id
                    """
                ),
                {"status": status, "error_message": error_message, "job_id": self.job_id},
            )


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
        for page in range(1, max_pages + 1):
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
        return rows

    async def fetch_one(
        self,
        client: httpx.AsyncClient,
        path: str,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        merged_params = {"api_token": self.token}
        if params:
            merged_params.update(params)
        response = await client.get(f"{self.base_url}/{path.lstrip('/')}", params=merged_params)
        response.raise_for_status()
        payload = response.json()
        data = payload.get("data", {})
        return data if isinstance(data, dict) else {}


def choose_league(leagues: list[dict[str, Any]], league_query: str) -> dict[str, Any] | None:
    if not leagues:
        return None
    south_african = [league for league in leagues if "south africa" in str(league).lower()]
    return south_african[0] if south_african else leagues[0]


def choose_season(
    seasons: list[dict[str, Any]],
    league_id: int,
    season_query: str | None = None,
) -> dict[str, Any] | None:
    scoped = [season for season in seasons if as_int(season.get("league_id")) == league_id]
    if not scoped:
        return None
    if season_query:
        query = season_query.lower()
        requested = [season for season in scoped if query in str(season.get("name", "")).lower()]
        if requested:
            return requested[0]
    current = [season for season in scoped if season.get("is_current")]
    if current:
        return current[0]
    return sorted(scoped, key=lambda row: row.get("starting_at") or "", reverse=True)[0]


async def resolve_league(
    client: httpx.AsyncClient,
    api: SportsmonksClient,
    league_spec: str,
) -> dict[str, Any] | None:
    if league_spec.isdigit():
        leagues = await api.fetch_pages(client, f"leagues/{league_spec}", max_pages=1)
        return leagues[0] if leagues else None
    leagues = await api.fetch_pages(client, f"leagues/search/{quote(league_spec)}", max_pages=1)
    return choose_league(leagues, league_spec)


def date_chunks(start_date: date, end_date: date) -> list[tuple[date, date]]:
    chunks = []
    current = start_date
    while current <= end_date:
        chunk_end = min(current + timedelta(days=FIXTURE_CHUNK_DAYS - 1), end_date)
        chunks.append((current, chunk_end))
        current = chunk_end + timedelta(days=1)
    return chunks


async def fetch_fixtures_chunked(
    client: httpx.AsyncClient,
    api: SportsmonksClient,
    league_id: int,
    start_date: date,
    end_date: date,
    logger: SyncLogger,
) -> list[dict[str, Any]]:
    fixtures: list[dict[str, Any]] = []
    for chunk_start, chunk_end in date_chunks(start_date, end_date):
        try:
            fixtures.extend(
                await api.fetch_pages(
                    client,
                    f"fixtures/between/{chunk_start.isoformat()}/{chunk_end.isoformat()}",
                    params={
                        "include": "participants;scores",
                        "filters": f"fixtureLeagues:{league_id}",
                    },
                    max_pages=10,
                )
            )
        except httpx.HTTPStatusError as exc:
            logger.log(
                f"Fixtures chunk {chunk_start} to {chunk_end} failed with HTTP {exc.response.status_code}.",
                "warning",
            )
    return fixtures


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


def sportmonks_team_map(engine: Engine) -> dict[int, int]:
    with engine.begin() as conn:
        rows = conn.execute(text("SELECT id, sportmonks_team_id FROM football.teams")).all()
    return {int(row.sportmonks_team_id): int(row.id) for row in rows}


def sportmonks_player_map(engine: Engine) -> dict[int, int]:
    with engine.begin() as conn:
        rows = conn.execute(text("SELECT id, sportmonks_player_id FROM football.players")).all()
    return {int(row.sportmonks_player_id): int(row.id) for row in rows}


def score_value(score: dict[str, Any]) -> int | None:
    value = score.get("score")
    if isinstance(value, dict):
        return as_int(value.get("goals") or value.get("score") or value.get("value"))
    return as_int(value)


def extract_fixture_scores(fixture: dict[str, Any], home_smid: int | None, away_smid: int | None) -> tuple[int | None, int | None]:
    home_score = None
    away_score = None
    scores = fixture.get("scores") or []
    if not isinstance(scores, list):
        return home_score, away_score
    preferred = [row for row in scores if str(row.get("description", "")).upper() in {"CURRENT", "FT", "2ND_HALF"}]
    for row in preferred or scores:
        participant_id = as_int(row.get("participant_id"))
        value = score_value(row)
        if participant_id == home_smid:
            home_score = value
        if participant_id == away_smid:
            away_score = value
    return home_score, away_score


def upsert_fixtures(engine: Engine, fixtures: list[dict[str, Any]], competition_id: int, season_id: int) -> int:
    if not fixtures:
        return 0

    teams = sportmonks_team_map(engine)
    with engine.begin() as conn:
        for fixture in fixtures:
            home_smid = None
            away_smid = None
            home_team_id = None
            away_team_id = None
            for participant in fixture.get("participants") or []:
                meta = participant.get("meta") or {}
                smid = as_int(participant.get("id"))
                local_id = teams.get(smid) if smid else None
                if meta.get("location") == "home":
                    home_smid = smid
                    home_team_id = local_id
                elif meta.get("location") == "away":
                    away_smid = smid
                    away_team_id = local_id
            home_score, away_score = extract_fixture_scores(fixture, home_smid, away_smid)

            conn.execute(
                text(
                    """
                    INSERT INTO football.fixtures (
                        sportmonks_fixture_id, competition_id, season_id, stage_id,
                        aggregate_id, venue_id, state_id, home_team_id, away_team_id,
                        home_score, away_score, starting_at, result_info, leg, length, is_placeholder
                    )
                    VALUES (
                        :sportmonks_fixture_id, :competition_id, :season_id, :stage_id,
                        :aggregate_id, :venue_id, :state_id, :home_team_id, :away_team_id,
                        :home_score, :away_score, :starting_at, :result_info, :leg, :length, :is_placeholder
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
                        home_score = EXCLUDED.home_score,
                        away_score = EXCLUDED.away_score,
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
                    "home_score": home_score,
                    "away_score": away_score,
                    "starting_at": parse_datetime(fixture.get("starting_at")),
                    "result_info": fixture.get("result_info"),
                    "leg": fixture.get("leg"),
                    "length": fixture.get("length"),
                    "is_placeholder": as_bool(fixture.get("placeholder")),
                },
            )
    return len(fixtures)


def player_payload(squad_row: dict[str, Any]) -> dict[str, Any] | None:
    player = squad_row.get("player")
    if isinstance(player, dict):
        return player
    return squad_row if squad_row.get("player_id") or squad_row.get("id") else None


def upsert_players_and_prices(engine: Engine, squad_rows: list[dict[str, Any]], season_id: int) -> tuple[int, int]:
    if not squad_rows:
        return 0, 0
    players = 0
    prices = 0
    with engine.begin() as conn:
        for squad_row in squad_rows:
            player = player_payload(squad_row)
            if not player:
                continue
            sportmonks_player_id = as_int(player.get("id") or squad_row.get("player_id"))
            if sportmonks_player_id is None:
                continue
            row = conn.execute(
                text(
                    """
                    INSERT INTO football.players (
                        sportmonks_player_id, firstname, lastname, display_name,
                        common_name, country_id, nationality_id, position_id,
                        detailed_position_id, date_of_birth, height, weight,
                        image_path, gender
                    )
                    VALUES (
                        :sportmonks_player_id, :firstname, :lastname, :display_name,
                        :common_name, :country_id, :nationality_id, :position_id,
                        :detailed_position_id, :date_of_birth, :height, :weight,
                        :image_path, :gender
                    )
                    ON CONFLICT (sportmonks_player_id)
                    DO UPDATE SET
                        firstname = EXCLUDED.firstname,
                        lastname = EXCLUDED.lastname,
                        display_name = EXCLUDED.display_name,
                        common_name = EXCLUDED.common_name,
                        country_id = EXCLUDED.country_id,
                        nationality_id = EXCLUDED.nationality_id,
                        position_id = EXCLUDED.position_id,
                        detailed_position_id = EXCLUDED.detailed_position_id,
                        date_of_birth = EXCLUDED.date_of_birth,
                        height = EXCLUDED.height,
                        weight = EXCLUDED.weight,
                        image_path = EXCLUDED.image_path,
                        gender = EXCLUDED.gender
                    RETURNING id
                    """
                ),
                {
                    "sportmonks_player_id": sportmonks_player_id,
                    "firstname": player.get("firstname"),
                    "lastname": player.get("lastname"),
                    "display_name": player.get("display_name") or player.get("name"),
                    "common_name": player.get("common_name"),
                    "country_id": player.get("country_id"),
                    "nationality_id": player.get("nationality_id"),
                    "position_id": player.get("position_id") or squad_row.get("position_id"),
                    "detailed_position_id": player.get("detailed_position_id") or squad_row.get("detailed_position_id"),
                    "date_of_birth": parse_date(player.get("date_of_birth") or player.get("birthdate")),
                    "height": as_int(player.get("height")),
                    "weight": as_int(player.get("weight")),
                    "image_path": player.get("image_path"),
                    "gender": player.get("gender"),
                },
            ).one()
            players += 1
            conn.execute(
                text(
                    """
                    INSERT INTO app.player_prices(player_id, season_id, price)
                    VALUES (:player_id, :season_id, 50.0)
                    ON CONFLICT (player_id, season_id) DO NOTHING
                    """
                ),
                {"player_id": int(row.id), "season_id": season_id},
            )
            prices += 1
    return players, prices


def detail_value(details: list[dict[str, Any]], *names: str) -> int | None:
    wanted = {name.lower() for name in names}
    for detail in details:
        name = str(detail.get("type", {}).get("name") or detail.get("name") or detail.get("type_id") or "").lower()
        if name in wanted:
            value = detail.get("value") or detail.get("total") or detail.get("points")
            return as_int(value)
    return None


def upsert_standings(engine: Engine, standings: list[dict[str, Any]], season_id: int) -> int:
    teams = sportmonks_team_map(engine)
    count = 0
    with engine.begin() as conn:
        for standing in standings:
            participant = standing.get("participant") or standing.get("team") or {}
            sportmonks_team_id = as_int(standing.get("participant_id") or participant.get("id") or standing.get("team_id"))
            team_id = teams.get(sportmonks_team_id) if sportmonks_team_id else None
            if team_id is None:
                continue
            details = standing.get("details") or []
            conn.execute(
                text(
                    """
                    INSERT INTO football.standings (
                        sportmonks_standing_id, season_id, team_id, position,
                        result, points, played, won, drawn, lost, goals_for,
                        goals_against, goal_difference, raw
                    )
                    VALUES (
                        :sportmonks_standing_id, :season_id, :team_id, :position,
                        :result, :points, :played, :won, :drawn, :lost, :goals_for,
                        :goals_against, :goal_difference, CAST(:raw AS JSONB)
                    )
                    ON CONFLICT (season_id, team_id)
                    DO UPDATE SET
                        sportmonks_standing_id = EXCLUDED.sportmonks_standing_id,
                        position = EXCLUDED.position,
                        result = EXCLUDED.result,
                        points = EXCLUDED.points,
                        played = EXCLUDED.played,
                        won = EXCLUDED.won,
                        drawn = EXCLUDED.drawn,
                        lost = EXCLUDED.lost,
                        goals_for = EXCLUDED.goals_for,
                        goals_against = EXCLUDED.goals_against,
                        goal_difference = EXCLUDED.goal_difference,
                        raw = EXCLUDED.raw
                    """
                ),
                {
                    "sportmonks_standing_id": standing.get("id"),
                    "season_id": season_id,
                    "team_id": team_id,
                    "position": as_int(standing.get("position")),
                    "result": standing.get("result"),
                    "points": detail_value(details, "points", "POINTS") or as_int(standing.get("points")),
                    "played": detail_value(details, "played", "overall matches played"),
                    "won": detail_value(details, "won", "overall won"),
                    "drawn": detail_value(details, "draw", "drawn", "overall draw"),
                    "lost": detail_value(details, "lost", "overall lost"),
                    "goals_for": detail_value(details, "goals for", "overall goals for"),
                    "goals_against": detail_value(details, "goals against", "overall goals against"),
                    "goal_difference": detail_value(details, "goal difference"),
                    "raw": json_dumps(standing),
                },
            )
            count += 1
    return count


def local_fixture_rows(engine: Engine, days_back: int) -> list[dict[str, Any]]:
    start = datetime.now(timezone.utc) - timedelta(days=days_back)
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT id, sportmonks_fixture_id
                FROM football.fixtures
                WHERE starting_at >= :start
                  AND starting_at <= NOW()
                ORDER BY starting_at DESC
                """
            ),
            {"start": start},
        ).mappings().all()
    return [dict(row) for row in rows]


def upsert_match_details(engine: Engine, fixture_id: int, detail: dict[str, Any]) -> SyncCounts:
    counts = SyncCounts()
    teams = sportmonks_team_map(engine)
    with engine.begin() as conn:
        for lineup in detail.get("lineups") or []:
            sportmonks_lineup_id = as_int(lineup.get("id")) or stable_id(fixture_id, "lineup", lineup.get("player_id"), lineup.get("team_id"), lineup.get("type_id"))
            conn.execute(
                text(
                    """
                    INSERT INTO football.player_lineups (
                        sportmonks_lineup_id, fixture_id, team_id, player_id, player_name,
                        jersey_number, position_id, type_id
                    )
                    VALUES (
                        :sportmonks_lineup_id, :fixture_id, :team_id, :player_id, :player_name,
                        :jersey_number, :position_id, :type_id
                    )
                    ON CONFLICT (sportmonks_lineup_id)
                    DO UPDATE SET
                        fixture_id = EXCLUDED.fixture_id,
                        team_id = EXCLUDED.team_id,
                        player_id = EXCLUDED.player_id,
                        player_name = EXCLUDED.player_name,
                        jersey_number = EXCLUDED.jersey_number,
                        position_id = EXCLUDED.position_id,
                        type_id = EXCLUDED.type_id
                    """
                ),
                {
                    "sportmonks_lineup_id": sportmonks_lineup_id,
                    "fixture_id": fixture_id,
                    "team_id": teams.get(as_int(lineup.get("team_id")) or 0),
                    "player_id": as_int(lineup.get("player_id")),
                    "player_name": lineup.get("player_name") or (lineup.get("player") or {}).get("display_name"),
                    "jersey_number": as_int(lineup.get("jersey_number")),
                    "position_id": as_int(lineup.get("position_id")),
                    "type_id": as_int(lineup.get("type_id")) or 0,
                },
            )
            counts.lineups += 1

        for event in detail.get("events") or []:
            sportmonks_event_id = as_int(event.get("id")) or stable_id(fixture_id, "event", event.get("player_id"), event.get("minute"), event.get("type_id"))
            conn.execute(
                text(
                    """
                    INSERT INTO football.match_events (
                        sportmonks_event_id, fixture_id, team_id, player_id,
                        related_player_id, player_name, related_player_name, type_id,
                        minute, extra_minute, result, addition, sort_order, rescinded, on_bench
                    )
                    VALUES (
                        :sportmonks_event_id, :fixture_id, :team_id, :player_id,
                        :related_player_id, :player_name, :related_player_name, :type_id,
                        :minute, :extra_minute, :result, :addition, :sort_order, :rescinded, :on_bench
                    )
                    ON CONFLICT (sportmonks_event_id)
                    DO UPDATE SET
                        fixture_id = EXCLUDED.fixture_id,
                        team_id = EXCLUDED.team_id,
                        player_id = EXCLUDED.player_id,
                        related_player_id = EXCLUDED.related_player_id,
                        player_name = EXCLUDED.player_name,
                        related_player_name = EXCLUDED.related_player_name,
                        type_id = EXCLUDED.type_id,
                        minute = EXCLUDED.minute,
                        extra_minute = EXCLUDED.extra_minute,
                        result = EXCLUDED.result,
                        addition = EXCLUDED.addition,
                        sort_order = EXCLUDED.sort_order,
                        rescinded = EXCLUDED.rescinded,
                        on_bench = EXCLUDED.on_bench
                    """
                ),
                {
                    "sportmonks_event_id": sportmonks_event_id,
                    "fixture_id": fixture_id,
                    "team_id": teams.get(as_int(event.get("team_id")) or 0),
                    "player_id": as_int(event.get("player_id")),
                    "related_player_id": as_int(event.get("related_player_id")),
                    "player_name": event.get("player_name"),
                    "related_player_name": event.get("related_player_name"),
                    "type_id": as_int(event.get("type_id")) or 0,
                    "minute": as_int(event.get("minute")),
                    "extra_minute": as_int(event.get("extra_minute")),
                    "result": event.get("result"),
                    "addition": event.get("addition"),
                    "sort_order": as_int(event.get("sort_order")),
                    "rescinded": event.get("rescinded"),
                    "on_bench": as_bool(event.get("on_bench")),
                },
            )
            counts.events += 1

        for stat in detail.get("statistics") or []:
            player_id = as_int(stat.get("player_id"))
            if player_id is None:
                continue
            type_id = as_int(stat.get("type_id")) or 0
            sportmonks_stat_id = as_int(stat.get("id")) or stable_id(fixture_id, "stat", player_id, type_id, stat.get("location"))
            value = stat.get("data", {}).get("value") if isinstance(stat.get("data"), dict) else stat.get("value")
            conn.execute(
                text(
                    """
                    INSERT INTO football.player_match_stats (
                        sportmonks_stat_id, fixture_id, team_id, player_id, type_id, value, location
                    )
                    VALUES (
                        :sportmonks_stat_id, :fixture_id, :team_id, :player_id, :type_id, :value, :location
                    )
                    ON CONFLICT (sportmonks_stat_id)
                    DO UPDATE SET
                        fixture_id = EXCLUDED.fixture_id,
                        team_id = EXCLUDED.team_id,
                        player_id = EXCLUDED.player_id,
                        type_id = EXCLUDED.type_id,
                        value = EXCLUDED.value,
                        location = EXCLUDED.location
                    """
                ),
                {
                    "sportmonks_stat_id": sportmonks_stat_id,
                    "fixture_id": fixture_id,
                    "team_id": teams.get(as_int(stat.get("team_id")) or 0),
                    "player_id": player_id,
                    "type_id": type_id,
                    "value": as_int(value),
                    "location": stat.get("location"),
                },
            )
            counts.statistics += 1
    return counts


def active_gameweeks(engine: Engine) -> list[dict[str, Any]]:
    today = date.today()
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT id, start_date, end_date
                FROM app.gameweeks
                WHERE is_active = TRUE
                   OR (:today BETWEEN start_date AND end_date)
                   OR end_date >= :recent
                ORDER BY start_date
                """
            ),
            {"today": today, "recent": today - timedelta(days=2)},
        ).mappings().all()
    return [dict(row) for row in rows]


def calculate_player_points(engine: Engine, gameweek: dict[str, Any]) -> dict[int, dict[str, Any]]:
    with engine.begin() as conn:
        lineup_rows = conn.execute(
            text(
                """
                SELECT p.id AS local_player_id, COUNT(*) AS appearances
                FROM football.player_lineups l
                JOIN football.players p ON p.sportmonks_player_id = l.player_id
                JOIN football.fixtures f ON f.id = l.fixture_id
                WHERE f.starting_at::date BETWEEN :start_date AND :end_date
                GROUP BY p.id
                """
            ),
            gameweek,
        ).mappings().all()
        event_rows = conn.execute(
            text(
                """
                SELECT p.id AS local_player_id, e.type_id, COUNT(*) AS count
                FROM football.match_events e
                JOIN football.players p ON p.sportmonks_player_id = e.player_id
                JOIN football.fixtures f ON f.id = e.fixture_id
                WHERE f.starting_at::date BETWEEN :start_date AND :end_date
                  AND COALESCE(e.rescinded, FALSE) = FALSE
                GROUP BY p.id, e.type_id
                """
            ),
            gameweek,
        ).mappings().all()

    results: dict[int, dict[str, Any]] = {}
    for row in lineup_rows:
        player_id = int(row.local_player_id)
        appearances = int(row.appearances)
        results.setdefault(player_id, {"base": 0, "breakdown": {}})
        results[player_id]["base"] += appearances
        results[player_id]["breakdown"]["appearances"] = appearances

    # Conservative fallback scoring until final Sportsmonks type IDs are confirmed.
    # Common mappings can be overridden in env as JSON, e.g. {"14":4,"15":3,"19":-1}.
    scoring = json.loads(env("TOUCHLINE_EVENT_POINT_MAP", "{}") or "{}")
    if not scoring:
        scoring = {
            "goal": 4,
            "assist": 3,
            "yellow_card": -1,
            "red_card": -3,
        }
    for row in event_rows:
        player_id = int(row.local_player_id)
        type_id = str(row.type_id)
        count = int(row.count)
        points = int(scoring.get(type_id, 0)) * count
        results.setdefault(player_id, {"base": 0, "breakdown": {}})
        results[player_id]["base"] += points
        results[player_id]["breakdown"][f"event_{type_id}"] = {"count": count, "points": points}
    return results


def upsert_points_and_leaderboards(engine: Engine) -> SyncCounts:
    counts = SyncCounts()
    for gameweek in active_gameweeks(engine):
        player_points = calculate_player_points(engine, gameweek)
        with engine.begin() as conn:
            squad_rows = conn.execute(
                text(
                    """
                    SELECT fs.fantasy_team_id, fs.player_id, fs.is_captain, fs.is_vice_captain,
                           ft.user_id
                    FROM app.fantasy_squads fs
                    JOIN app.fantasy_teams ft ON ft.id = fs.fantasy_team_id
                    WHERE fs.gameweek_id = :id
                      AND fs.is_on_bench = FALSE
                    """
                ),
                gameweek,
            ).mappings().all()
            team_totals: dict[int, dict[str, Any]] = {}
            rows_by_team: dict[int, list[Any]] = {}
            for row in squad_rows:
                rows_by_team.setdefault(int(row.fantasy_team_id), []).append(row)

            for fantasy_team_id, team_rows in rows_by_team.items():
                captain_played = any(
                    row.is_captain and int(player_points.get(int(row.player_id), {"base": 0})["base"]) > 0
                    for row in team_rows
                )
                for row in team_rows:
                    data = player_points.get(int(row.player_id), {"base": 0, "breakdown": {}})
                    multiplier = 2 if row.is_captain or (row.is_vice_captain and not captain_played) else 1
                    points = int(data["base"]) * multiplier
                    breakdown = dict(data["breakdown"])
                    breakdown["multiplier"] = multiplier
                    conn.execute(
                        text(
                            """
                            INSERT INTO app.points_results (
                                fantasy_team_id, player_id, gameweek_id, points, breakdown
                            )
                            VALUES (
                                :fantasy_team_id, :player_id, :gameweek_id, :points, CAST(:breakdown AS JSONB)
                            )
                            ON CONFLICT (fantasy_team_id, player_id, gameweek_id)
                            DO UPDATE SET
                                points = EXCLUDED.points,
                                breakdown = EXCLUDED.breakdown
                            """
                        ),
                        {
                            "fantasy_team_id": row.fantasy_team_id,
                            "player_id": row.player_id,
                            "gameweek_id": gameweek["id"],
                            "points": points,
                            "breakdown": json_dumps(breakdown),
                        },
                    )
                    counts.points_results += 1
                    team = team_totals.setdefault(fantasy_team_id, {"user_id": row.user_id, "total": 0})
                    team["total"] += points

            ranked = sorted(team_totals.items(), key=lambda item: item[1]["total"], reverse=True)
            for rank, (fantasy_team_id, data) in enumerate(ranked, start=1):
                conn.execute(
                    text(
                        """
                        INSERT INTO app.leaderboards (
                            gameweek_id, user_id, fantasy_team_id, total_points, rank
                        )
                        VALUES (
                            :gameweek_id, :user_id, :fantasy_team_id, :total_points, :rank
                        )
                        ON CONFLICT (fantasy_team_id, gameweek_id)
                        DO UPDATE SET
                            user_id = EXCLUDED.user_id,
                            total_points = EXCLUDED.total_points,
                            rank = EXCLUDED.rank
                        """
                    ),
                    {
                        "gameweek_id": gameweek["id"],
                        "user_id": data["user_id"],
                        "fantasy_team_id": fantasy_team_id,
                        "total_points": data["total"],
                        "rank": rank,
                    },
                )
                counts.leaderboards += 1
    return counts


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
                "response": json_dumps(payload),
                "expires_at": expires_at,
            },
        )
    return 1


async def sync_core_league(
    client: httpx.AsyncClient,
    api: SportsmonksClient,
    engine: Engine | None,
    write: bool,
    league_spec: str,
    season_query: str,
    fixture_days_back: int,
    fixture_days_forward: int,
    logger: SyncLogger,
) -> tuple[SyncCounts, dict[str, int] | None]:
    counts = SyncCounts()
    league = await resolve_league(client, api, league_spec)
    if not league:
        logger.log(f"No league returned for '{league_spec}'.", "warning")
        return counts, None
    counts.competitions = 1

    seasons = await api.fetch_pages(
        client,
        "seasons",
        params={"filters": f"seasonLeagues:{league['id']}"},
        max_pages=5,
    )
    season = choose_season(seasons, int(league["id"]), season_query)
    if not season:
        logger.log(f"No season returned for league '{league.get('name')}'.", "warning")
        return counts, None
    counts.seasons = 1

    teams = await api.fetch_pages(client, f"teams/seasons/{season['id']}", max_pages=3)
    counts.teams = len(teams)

    today = datetime.now(timezone.utc).date()
    start_date = today - timedelta(days=fixture_days_back)
    end_date = today + timedelta(days=fixture_days_forward)
    fixtures = await fetch_fixtures_chunked(
        client,
        api,
        int(league["id"]),
        start_date,
        end_date,
        logger,
    )
    counts.fixtures = len(fixtures)
    logger.log(
        f"Core: {league.get('name')} / {season.get('name')} fetched "
        f"{counts.teams} teams and {counts.fixtures} fixtures."
    )

    ids = None
    if write:
        if engine is None:
            raise RuntimeError("Database engine was not created.")
        competition_db_id = upsert_competition(engine, league)
        season_db_id = upsert_season(engine, season, competition_db_id)
        counts.teams = upsert_teams(engine, teams)
        counts.fixtures = upsert_fixtures(engine, fixtures, competition_db_id, season_db_id)
        ids = {
            "league_smid": int(league["id"]),
            "season_smid": int(season["id"]),
            "competition_id": competition_db_id,
            "season_id": season_db_id,
        }
    return counts, ids


async def sync_players(
    client: httpx.AsyncClient,
    api: SportsmonksClient,
    engine: Engine | None,
    write: bool,
    season_smid: int,
    season_id: int,
    logger: SyncLogger,
) -> SyncCounts:
    counts = SyncCounts()
    if engine is None:
        return counts
    team_rows = sportmonks_team_map(engine)
    for sportmonks_team_id in team_rows.keys():
        squad = await api.fetch_pages(
            client,
            f"squads/seasons/{season_smid}/teams/{sportmonks_team_id}",
            params={"include": "player"},
            max_pages=3,
        )
        counts.players += len(squad)
        if write:
            players, prices = upsert_players_and_prices(engine, squad, season_id)
            counts.players += players - len(squad)
            counts.player_prices += prices
    logger.log(f"Players: processed {counts.players} squad rows.")
    return counts


async def sync_standings_phase(
    client: httpx.AsyncClient,
    api: SportsmonksClient,
    engine: Engine | None,
    write: bool,
    season_smid: int,
    season_id: int,
    logger: SyncLogger,
) -> SyncCounts:
    counts = SyncCounts()
    standings = await api.fetch_pages(
        client,
        f"standings/seasons/{season_smid}",
        params={"include": "participant;details.type"},
        max_pages=5,
    )
    counts.standings = len(standings)
    if write:
        if engine is None:
            raise RuntimeError("Database engine was not created.")
        counts.standings = upsert_standings(engine, standings, season_id)
    logger.log(f"Standings: processed {counts.standings} rows.")
    return counts


async def sync_match_details_phase(
    client: httpx.AsyncClient,
    api: SportsmonksClient,
    engine: Engine | None,
    write: bool,
    days_back: int,
    logger: SyncLogger,
) -> SyncCounts:
    counts = SyncCounts()
    if engine is None:
        return counts
    fixtures = local_fixture_rows(engine, days_back)
    for fixture in fixtures:
        detail = await api.fetch_one(
            client,
            f"fixtures/{fixture['sportmonks_fixture_id']}",
            params={"include": "lineups;events;statistics"},
        )
        if write:
            counts.add(upsert_match_details(engine, int(fixture["id"]), detail))
    logger.log(f"Match details: processed {len(fixtures)} fixtures.")
    return counts


async def run_pipeline(args: argparse.Namespace) -> SyncCounts:
    load_dotenv()
    engine = make_engine() if args.write else None
    logger = SyncLogger(engine, args.write)
    logger.start()
    total = SyncCounts()

    try:
        timeout = httpx.Timeout(30.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            api = SportsmonksClient()
            league_specs = [item.strip() for item in args.leagues.split(",") if item.strip()]
            synced_seasons: list[dict[str, int]] = []

            if "core" in args.phases:
                for league_spec in league_specs:
                    counts, ids = await sync_core_league(
                        client=client,
                        api=api,
                        engine=engine,
                        write=args.write,
                        league_spec=league_spec,
                        season_query=args.season_query,
                        fixture_days_back=args.fixture_days_back,
                        fixture_days_forward=args.fixture_days_forward,
                        logger=logger,
                    )
                    total.add(counts)
                    if ids:
                        synced_seasons.append(ids)

            if args.write and not synced_seasons and engine is not None:
                with engine.begin() as conn:
                    synced_seasons = [
                        dict(row)
                        for row in conn.execute(
                            text(
                                """
                                SELECT c.sportmonks_competition_id AS league_smid,
                                       s.sportmonks_season_id AS season_smid,
                                       c.id AS competition_id,
                                       s.id AS season_id
                                FROM football.seasons s
                                JOIN football.competitions c ON c.id = s.competition_id
                                WHERE s.is_current = TRUE
                                """
                            )
                        ).mappings().all()
                    ]

            if "players" in args.phases:
                for ids in synced_seasons:
                    total.add(await sync_players(client, api, engine, args.write, ids["season_smid"], ids["season_id"], logger))

            if "standings" in args.phases:
                for ids in synced_seasons:
                    total.add(await sync_standings_phase(client, api, engine, args.write, ids["season_smid"], ids["season_id"], logger))

            if "details" in args.phases:
                total.add(await sync_match_details_phase(client, api, engine, args.write, args.match_details_days_back, logger))

            if "points" in args.phases and args.write:
                if engine is None:
                    raise RuntimeError("Database engine was not created.")
                counts = upsert_points_and_leaderboards(engine)
                total.add(counts)
                logger.log(f"Points: upserted {counts.points_results} player results.")
                logger.log(f"Leaderboards: upserted {counts.leaderboards} rows.")

            if "news" in args.phases:
                try:
                    payload = await fetch_gnews(client, args.news_max)
                    total.news_cache = 1 if payload.get("articles") else 0
                    if args.write and engine is not None:
                        total.news_cache = upsert_news_cache(engine, payload, args.news_max)
                    logger.log(f"News: processed {total.news_cache} cache row.")
                except RuntimeError as exc:
                    logger.log(str(exc), "warning")

        logger.complete("success")
        return total
    except Exception as exc:
        logger.log(str(exc), "error")
        logger.complete("failed", str(exc))
        raise


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the Touchline full sync pipeline.")
    parser.add_argument("--write", action="store_true", help="Write fetched data into the database.")
    parser.add_argument("--leagues", default=env("TOUCHLINE_LEAGUE_QUERIES", DEFAULT_LEAGUES))
    parser.add_argument("--season-query", default=env("TOUCHLINE_SEASON_QUERY", "2025/2026"))
    parser.add_argument("--fixture-days-back", type=int, default=30)
    parser.add_argument("--fixture-days-forward", type=int, default=30)
    parser.add_argument("--match-details-days-back", type=int, default=7)
    parser.add_argument("--news-max", type=int, default=10)
    parser.add_argument(
        "--phases",
        default="core,players,standings,details,points,news",
        help="Comma-separated phases: core,players,standings,details,points,news",
    )
    args = parser.parse_args()
    args.phases = {phase.strip() for phase in args.phases.split(",") if phase.strip()}
    return args


def print_counts(counts: SyncCounts) -> None:
    print("Sync totals:")
    for field in counts.__dataclass_fields__:
        print(f"  {field}: {getattr(counts, field)}")


async def main() -> int:
    counts = await run_pipeline(parse_args())
    print_counts(counts)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
