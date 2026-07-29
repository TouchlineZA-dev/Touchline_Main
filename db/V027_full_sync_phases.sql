-- =============================================================================
-- V027: Full football sync support
-- Adds tables/constraints needed by the phase 1-8 sync worker.
-- =============================================================================

CREATE TABLE IF NOT EXISTS football.standings (
    id                          SERIAL      PRIMARY KEY,
    sportmonks_standing_id       BIGINT      UNIQUE,
    season_id                   INTEGER     NOT NULL REFERENCES football.seasons(id),
    team_id                     INTEGER     NOT NULL REFERENCES football.teams(id),
    position                    SMALLINT,
    result                      VARCHAR(50),
    points                      SMALLINT,
    played                      SMALLINT,
    won                         SMALLINT,
    drawn                       SMALLINT,
    lost                        SMALLINT,
    goals_for                   SMALLINT,
    goals_against               SMALLINT,
    goal_difference             SMALLINT,
    raw                         JSONB,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(season_id, team_id)
);

CREATE OR REPLACE TRIGGER trg_standings_updated_at
    BEFORE UPDATE ON football.standings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE football.player_match_stats
    ADD COLUMN IF NOT EXISTS player_id INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS uq_points_results_team_player_gw
    ON app.points_results(fantasy_team_id, player_id, gameweek_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_leaderboards_team_gw
    ON app.leaderboards(fantasy_team_id, gameweek_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gameweek_sync_status_gw
    ON sync.gameweek_sync_status(gameweek_id);

ALTER TABLE sync.sync_jobs
    ADD COLUMN IF NOT EXISTS job_type VARCHAR(50);

UPDATE sync.sync_jobs
SET job_type = 'legacy'
WHERE job_type IS NULL;

ALTER TABLE sync.sync_jobs
    ALTER COLUMN job_type SET DEFAULT 'full_pipeline';

ALTER TABLE sync.sync_jobs
    ALTER COLUMN job_type SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_standings_season ON football.standings(season_id);
CREATE INDEX IF NOT EXISTS idx_standings_team ON football.standings(team_id);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_player ON football.player_match_stats(player_id);

GRANT SELECT, INSERT, UPDATE ON football.standings TO sync_worker_user;
GRANT USAGE, SELECT ON SEQUENCE football.standings_id_seq TO sync_worker_user;
GRANT SELECT ON football.standings TO app_api_user;

GRANT SELECT, INSERT, UPDATE ON app.player_prices TO sync_worker_user;
GRANT SELECT, INSERT, UPDATE ON app.points_results TO sync_worker_user;
GRANT SELECT, INSERT, UPDATE ON app.leaderboards TO sync_worker_user;
GRANT SELECT ON app.fantasy_teams TO sync_worker_user;
GRANT SELECT ON app.fantasy_squads TO sync_worker_user;
GRANT SELECT ON app.users TO sync_worker_user;
GRANT USAGE, SELECT ON SEQUENCE app.player_prices_id_seq TO sync_worker_user;
GRANT USAGE, SELECT ON SEQUENCE app.points_results_id_seq TO sync_worker_user;
GRANT USAGE, SELECT ON SEQUENCE app.leaderboards_id_seq TO sync_worker_user;
