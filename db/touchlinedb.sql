-- =============================================================================
-- TOUCHLINE SUPABASE SCHEMA
-- Single-file consolidated schema (V001–V025)
-- Run this entire script in: Supabase → SQL Editor → New query → Run
-- =============================================================================


-- =============================================================================
-- SECTION 1: SCHEMAS
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS football;
CREATE SCHEMA IF NOT EXISTS sync;
CREATE SCHEMA IF NOT EXISTS app;


-- =============================================================================
-- SECTION 2: ROLES
-- NOTE: In Supabase you cannot use CREATE USER/CREATE ROLE directly.
-- Instead, use Supabase Dashboard → Settings → Database → Roles
-- OR run via the SQL editor as a superadmin. The two roles below map to:
--   sync_worker_user  → your Python sync service (backend worker)
--   app_api_user      → your API / PostgREST consumer
-- If the roles already exist (e.g. from a previous run), the DO block skips them.
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sync_worker_user') THEN
        CREATE ROLE sync_worker_user WITH LOGIN PASSWORD 'Touchline_Khanya';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_api_user') THEN
        CREATE ROLE app_api_user WITH LOGIN PASSWORD 'Khanya_Touchline';
    END IF;
END
$$;

-- Grant schema usage up front
GRANT USAGE ON SCHEMA football TO sync_worker_user, app_api_user;
GRANT USAGE ON SCHEMA sync     TO sync_worker_user, app_api_user;
GRANT USAGE ON SCHEMA app      TO sync_worker_user, app_api_user;


-- =============================================================================
-- SECTION 3: SHARED TRIGGER FUNCTION (auto-update updated_at)
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- SECTION 4: FOOTBALL SCHEMA TABLES
-- =============================================================================

-- ── football.competitions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS football.competitions (
    id                         SERIAL       PRIMARY KEY,
    sportmonks_competition_id  INTEGER      NOT NULL UNIQUE,
    name                       VARCHAR(150) NOT NULL,
    short_code                 VARCHAR(20),
    country_id                 INTEGER,
    type                       VARCHAR(30),
    sub_type                   VARCHAR(30),
    active                     BOOLEAN      NOT NULL DEFAULT TRUE,
    image_path                 TEXT,
    category                   SMALLINT,
    created_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_competitions_updated_at
    BEFORE UPDATE ON football.competitions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── football.seasons ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS football.seasons (
    id                      SERIAL      PRIMARY KEY,
    sportmonks_season_id    INTEGER     NOT NULL UNIQUE,
    competition_id          INTEGER     NOT NULL REFERENCES football.competitions(id),
    name                    VARCHAR(20) NOT NULL,
    starting_at             DATE,
    ending_at               DATE,
    is_current              BOOLEAN     NOT NULL DEFAULT FALSE,
    finished                BOOLEAN     NOT NULL DEFAULT FALSE,
    pending                 BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_seasons_updated_at
    BEFORE UPDATE ON football.seasons
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── football.teams ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS football.teams (
    id                      SERIAL       PRIMARY KEY,
    sportmonks_team_id      INTEGER      NOT NULL UNIQUE,
    name                    VARCHAR(150) NOT NULL,
    short_code              VARCHAR(20),
    country_id              INTEGER,
    venue_id                INTEGER,
    founded                 SMALLINT,
    type                    VARCHAR(30),
    image_path              TEXT,
    is_placeholder          BOOLEAN     NOT NULL DEFAULT FALSE,
    last_played_at          TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_teams_updated_at
    BEFORE UPDATE ON football.teams
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── football.players ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS football.players (
    id                      SERIAL       PRIMARY KEY,
    sportmonks_player_id    INTEGER      NOT NULL UNIQUE,
    firstname               VARCHAR(100),
    lastname                VARCHAR(100),
    display_name            VARCHAR(150),
    common_name             VARCHAR(100),
    country_id              INTEGER,
    nationality_id          INTEGER,
    position_id             SMALLINT,
    detailed_position_id    SMALLINT,
    date_of_birth           DATE,
    height                  SMALLINT,
    weight                  SMALLINT,
    image_path              TEXT,
    gender                  VARCHAR(10),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_players_updated_at
    BEFORE UPDATE ON football.players
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── football.fixtures ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS football.fixtures (
    id                      SERIAL      PRIMARY KEY,
    sportmonks_fixture_id   INTEGER     NOT NULL UNIQUE,
    competition_id          INTEGER     NOT NULL REFERENCES football.competitions(id),
    season_id               INTEGER     NOT NULL REFERENCES football.seasons(id),
    stage_id                INTEGER,
    aggregate_id            INTEGER,
    venue_id                INTEGER,
    state_id                SMALLINT,
    home_team_id            INTEGER     REFERENCES football.teams(id),
    away_team_id            INTEGER     REFERENCES football.teams(id),
    home_score              SMALLINT,
    away_score              SMALLINT,
    home_penalty_score      SMALLINT,
    away_penalty_score      SMALLINT,
    starting_at             TIMESTAMPTZ,
    result_info             TEXT,
    leg                     VARCHAR(5),
    length                  SMALLINT,
    is_placeholder          BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_fixtures_updated_at
    BEFORE UPDATE ON football.fixtures
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── football.player_match_stats ──────────────────────────────────────────────
-- player_id is a raw integer (not FK) — stats may arrive before the player is synced.
CREATE TABLE IF NOT EXISTS football.player_match_stats (
    id                      SERIAL      PRIMARY KEY,
    sportmonks_stat_id      INTEGER     NOT NULL UNIQUE,
    fixture_id              INTEGER     NOT NULL REFERENCES football.fixtures(id),
    team_id                 INTEGER     REFERENCES football.teams(id),
    type_id                 SMALLINT    NOT NULL,
    value                   INTEGER,
    location                VARCHAR(5),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_player_match_stats_updated_at
    BEFORE UPDATE ON football.player_match_stats
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── football.match_events ────────────────────────────────────────────────────
-- player_id and related_player_id are raw integers (not FKs): events may
-- reference players not yet present in football.players.
CREATE TABLE IF NOT EXISTS football.match_events (
    id                      SERIAL       PRIMARY KEY,
    sportmonks_event_id     INTEGER      NOT NULL UNIQUE,
    fixture_id              INTEGER      NOT NULL REFERENCES football.fixtures(id),
    team_id                 INTEGER      REFERENCES football.teams(id),
    player_id               INTEGER,
    related_player_id       INTEGER,
    player_name             VARCHAR(150),
    related_player_name     VARCHAR(150),
    type_id                 SMALLINT     NOT NULL,
    minute                  SMALLINT,
    extra_minute            SMALLINT,
    result                  VARCHAR(10),
    addition                VARCHAR(100),
    sort_order              SMALLINT,
    rescinded               BOOLEAN,
    on_bench                BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_match_events_updated_at
    BEFORE UPDATE ON football.match_events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── football.player_lineups ──────────────────────────────────────────────────
-- player_id is a raw integer (not FK) for the same reason as match_events.
CREATE TABLE IF NOT EXISTS football.player_lineups (
    id                      SERIAL       PRIMARY KEY,
    sportmonks_lineup_id    BIGINT       NOT NULL UNIQUE,
    fixture_id              INTEGER      NOT NULL REFERENCES football.fixtures(id),
    team_id                 INTEGER      REFERENCES football.teams(id),
    player_id               INTEGER,
    player_name             VARCHAR(150),
    jersey_number           SMALLINT,
    position_id             SMALLINT,
    type_id                 SMALLINT     NOT NULL,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_player_lineups_updated_at
    BEFORE UPDATE ON football.player_lineups
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- SECTION 5: APP SCHEMA TABLES
-- (app.gameweeks must come before sync.gameweek_sync_status — FK dependency)
-- =============================================================================

-- ── app.gameweeks ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.gameweeks (
    id              SERIAL      PRIMARY KEY,
    name            VARCHAR(50) NOT NULL,
    start_date      DATE        NOT NULL,
    end_date        DATE        NOT NULL,
    is_active       BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_gameweeks_updated_at
    BEFORE UPDATE ON app.gameweeks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── app.users ─────────────────────────────────────────────────────────────────
-- Supabase handles authentication via auth.users (built-in).
-- This table stores app-level profile data linked to auth.users.
-- auth_user_id links to Supabase's auth.users.id (UUID).
-- password_hash is omitted — Supabase auth handles credentials securely.
CREATE TABLE IF NOT EXISTS app.users (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id    UUID         UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON app.users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── app.fantasy_teams ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.fantasy_teams (
    id                  SERIAL       PRIMARY KEY,
    user_id             UUID         NOT NULL REFERENCES app.users(id),
    season_id           INTEGER      NOT NULL REFERENCES football.seasons(id),
    name                VARCHAR(100) NOT NULL,
    budget_remaining    NUMERIC(5,1) NOT NULL DEFAULT 300.0,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, season_id)
);

CREATE OR REPLACE TRIGGER trg_fantasy_teams_updated_at
    BEFORE UPDATE ON app.fantasy_teams
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── app.fantasy_squads ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.fantasy_squads (
    id                  SERIAL       PRIMARY KEY,
    fantasy_team_id     INTEGER      NOT NULL REFERENCES app.fantasy_teams(id),
    player_id           INTEGER      NOT NULL REFERENCES football.players(id),
    gameweek_id         INTEGER      NOT NULL REFERENCES app.gameweeks(id),
    is_captain          BOOLEAN      NOT NULL DEFAULT FALSE,
    is_vice_captain     BOOLEAN      NOT NULL DEFAULT FALSE,
    is_on_bench         BOOLEAN      NOT NULL DEFAULT FALSE,
    purchase_price      NUMERIC(5,1),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_fantasy_squads_updated_at
    BEFORE UPDATE ON app.fantasy_squads
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── app.points_results ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.points_results (
    id                  SERIAL      PRIMARY KEY,
    fantasy_team_id     INTEGER     NOT NULL REFERENCES app.fantasy_teams(id),
    player_id           INTEGER     NOT NULL REFERENCES football.players(id),
    gameweek_id         INTEGER     NOT NULL REFERENCES app.gameweeks(id),
    points              INTEGER     NOT NULL DEFAULT 0,
    breakdown           JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_points_results_updated_at
    BEFORE UPDATE ON app.points_results
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── app.leaderboards ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.leaderboards (
    id                  SERIAL      PRIMARY KEY,
    gameweek_id         INTEGER     NOT NULL REFERENCES app.gameweeks(id),
    user_id             UUID        NOT NULL REFERENCES app.users(id),
    fantasy_team_id     INTEGER     NOT NULL REFERENCES app.fantasy_teams(id),
    total_points        INTEGER     NOT NULL DEFAULT 0,
    rank                INTEGER,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_leaderboards_updated_at
    BEFORE UPDATE ON app.leaderboards
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── app.player_prices ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.player_prices (
    id              SERIAL       PRIMARY KEY,
    player_id       INTEGER      NOT NULL REFERENCES football.players(id),
    season_id       INTEGER      NOT NULL REFERENCES football.seasons(id),
    price           NUMERIC(5,1) NOT NULL DEFAULT 50.0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(player_id, season_id)
);

CREATE OR REPLACE TRIGGER trg_player_prices_updated_at
    BEFORE UPDATE ON app.player_prices
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── app.player_price_changes ──────────────────────────────────────────────────
-- Append-only audit log: no updated_at column, no update trigger.
CREATE TABLE IF NOT EXISTS app.player_price_changes (
    id              SERIAL       PRIMARY KEY,
    player_id       INTEGER      NOT NULL REFERENCES football.players(id),
    season_id       INTEGER      NOT NULL REFERENCES football.seasons(id),
    gameweek_id     INTEGER      NOT NULL REFERENCES app.gameweeks(id),
    old_price       NUMERIC(5,1) NOT NULL,
    new_price       NUMERIC(5,1) NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- SECTION 6: SYNC SCHEMA TABLES
-- (Placed after app.gameweeks to satisfy FK dependency)
-- =============================================================================

-- ── sync.sync_jobs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync.sync_jobs (
    id              SERIAL      PRIMARY KEY,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    status          VARCHAR(20) NOT NULL DEFAULT 'running',
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_sync_jobs_updated_at
    BEFORE UPDATE ON sync.sync_jobs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── sync.sync_logs ────────────────────────────────────────────────────────────
-- Append-only: no updated_at column, no update trigger.
CREATE TABLE IF NOT EXISTS sync.sync_logs (
    id              SERIAL      PRIMARY KEY,
    sync_job_id     INTEGER     NOT NULL REFERENCES sync.sync_jobs(id),
    message         TEXT        NOT NULL,
    level           VARCHAR(10) NOT NULL DEFAULT 'info',
    logged_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── sync.gameweek_sync_status ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync.gameweek_sync_status (
    id                  SERIAL      PRIMARY KEY,
    gameweek_id         INTEGER     NOT NULL REFERENCES app.gameweeks(id),
    fixtures_complete   BOOLEAN     NOT NULL DEFAULT FALSE,
    events_complete     BOOLEAN     NOT NULL DEFAULT FALSE,
    stats_complete      BOOLEAN     NOT NULL DEFAULT FALSE,
    marked_complete     BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_gameweek_sync_status_updated_at
    BEFORE UPDATE ON sync.gameweek_sync_status
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- SECTION 7: INDEXES
-- =============================================================================

-- football schema
CREATE INDEX IF NOT EXISTS idx_fixtures_season              ON football.fixtures(season_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_competition         ON football.fixtures(competition_id);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_fixture   ON football.player_match_stats(fixture_id);
CREATE INDEX IF NOT EXISTS idx_match_events_fixture         ON football.match_events(fixture_id);
CREATE INDEX IF NOT EXISTS idx_player_lineups_fixture       ON football.player_lineups(fixture_id);

-- app schema
CREATE INDEX IF NOT EXISTS idx_fantasy_squads_gameweek      ON app.fantasy_squads(gameweek_id);
CREATE INDEX IF NOT EXISTS idx_points_results_gameweek      ON app.points_results(gameweek_id);
CREATE INDEX IF NOT EXISTS idx_leaderboards_gameweek        ON app.leaderboards(gameweek_id);
CREATE INDEX IF NOT EXISTS idx_player_prices_season         ON app.player_prices(season_id);
CREATE INDEX IF NOT EXISTS idx_price_changes_player_season  ON app.player_price_changes(player_id, season_id);

-- sync schema
CREATE INDEX IF NOT EXISTS idx_sync_logs_job                ON sync.sync_logs(sync_job_id);


-- =============================================================================
-- SECTION 8: ROW LEVEL SECURITY (RLS)
-- Supabase best practice: enable RLS on all app.* tables so users can only
-- access their own data via the auto-generated API.
-- =============================================================================

ALTER TABLE app.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.fantasy_teams       ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.fantasy_squads      ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.points_results      ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.leaderboards        ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.player_prices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.player_price_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.gameweeks           ENABLE ROW LEVEL SECURITY;

-- app.users: each user reads/updates only their own profile
CREATE POLICY "users_self_select" ON app.users
    FOR SELECT USING (auth.uid() = auth_user_id);
CREATE POLICY "users_self_update" ON app.users
    FOR UPDATE USING (auth.uid() = auth_user_id);
CREATE POLICY "users_self_insert" ON app.users
    FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

-- app.gameweeks: all authenticated users can read
CREATE POLICY "gameweeks_public_read" ON app.gameweeks
    FOR SELECT USING (auth.role() = 'authenticated');

-- app.fantasy_teams: users manage only their own teams
CREATE POLICY "fantasy_teams_owner" ON app.fantasy_teams
    FOR ALL USING (
        user_id = (SELECT id FROM app.users WHERE auth_user_id = auth.uid())
    );

-- app.fantasy_squads: users manage only squads on their teams
CREATE POLICY "fantasy_squads_owner" ON app.fantasy_squads
    FOR ALL USING (
        fantasy_team_id IN (
            SELECT id FROM app.fantasy_teams
            WHERE user_id = (SELECT id FROM app.users WHERE auth_user_id = auth.uid())
        )
    );

-- app.points_results: users read only their own points
CREATE POLICY "points_results_owner" ON app.points_results
    FOR SELECT USING (
        fantasy_team_id IN (
            SELECT id FROM app.fantasy_teams
            WHERE user_id = (SELECT id FROM app.users WHERE auth_user_id = auth.uid())
        )
    );

-- app.leaderboards: all authenticated users can read
CREATE POLICY "leaderboards_public_read" ON app.leaderboards
    FOR SELECT USING (auth.role() = 'authenticated');

-- app.player_prices: all authenticated users can read
CREATE POLICY "player_prices_public_read" ON app.player_prices
    FOR SELECT USING (auth.role() = 'authenticated');

-- app.player_price_changes: all authenticated users can read
CREATE POLICY "price_changes_public_read" ON app.player_price_changes
    FOR SELECT USING (auth.role() = 'authenticated');


-- =============================================================================
-- SECTION 9: ROLE PERMISSIONS
-- =============================================================================

-- sync_worker_user: full CRUD on football + sync; read-only on app.gameweeks
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA football TO sync_worker_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA football TO sync_worker_user;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA sync TO sync_worker_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sync TO sync_worker_user;
GRANT SELECT ON app.gameweeks TO sync_worker_user;

-- app_api_user: read-only on football + sync; full CRUD on app
GRANT SELECT ON ALL TABLES IN SCHEMA football TO app_api_user;
GRANT SELECT ON ALL TABLES IN SCHEMA sync TO app_api_user;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA app TO app_api_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO app_api_user;


-- =============================================================================
-- V026: NEWS CACHE TABLE
-- Stores GNews API responses to reduce daily quota consumption.
-- Keyed by cache_key (e.g. "headlines:10", "team:orlando_pirates:10").
-- Rows with expires_at < NOW() are stale and refreshed on next request.
-- =============================================================================

CREATE TABLE IF NOT EXISTS app.news_cache (
    id          SERIAL       PRIMARY KEY,
    cache_key   VARCHAR(255) NOT NULL UNIQUE,
    response    JSONB        NOT NULL,
    fetched_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_news_cache_key     ON app.news_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_news_cache_expires ON app.news_cache(expires_at);

-- RLS: news cache is managed by the backend service, not exposed to end users
ALTER TABLE app.news_cache ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- END OF SCHEMA
-- Schemas : football, sync, app
-- Tables  : 20 total
--   football (8): competitions, seasons, teams, players, fixtures,
--                 player_match_stats, match_events, player_lineups
--   sync     (3): sync_jobs, sync_logs, gameweek_sync_status
--   app      (9): gameweeks, users, fantasy_teams, fantasy_squads,
--                 points_results, leaderboards, player_prices,
--                 player_price_changes, news_cache
-- =============================================================================
