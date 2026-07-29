-- ============================================================================
-- Database Build Function - Tables Only
-- This function creates all tables (V002-V025) assuming schemas already exist
-- ============================================================================

CREATE OR REPLACE FUNCTION public.build_database_tables()
RETURNS TABLE (
	migration_version VARCHAR,
	migration_name VARCHAR,
	execution_status VARCHAR,
	execution_time TIMESTAMP
) AS $$
DECLARE
	v_version VARCHAR;
	v_name VARCHAR;
	v_status VARCHAR;
	v_start_time TIMESTAMP;
	v_migration_count INTEGER := 0;
BEGIN
	-- V002: Timestamp Trigger Function
	BEGIN
		v_version := '002';
		v_name := 'timestamp_trigger';
		v_start_time := NOW();

		CREATE OR REPLACE FUNCTION set_updated_at()
		RETURNS TRIGGER AS $trigger$ BEGIN
			NEW.updated_at = NOW();
			RETURN NEW;
		END; $trigger$ LANGUAGE plpgsql;

		execution_status := 'SUCCESS';
		RETURN NEXT;
		v_migration_count := v_migration_count + 1;
	EXCEPTION WHEN OTHERS THEN
		execution_status := 'FAILED: ' || SQLERRM;
		execution_time := NOW();
		RETURN NEXT;
	END;

	-- V003: Football Competitions
	BEGIN
		v_version := '003';
		v_name := 'football_competitions';
		v_start_time := NOW();

		CREATE TABLE IF NOT EXISTS football.competitions (
			id SERIAL PRIMARY KEY,
			sportmonks_competition_id INTEGER NOT NULL UNIQUE,
			name VARCHAR(150) NOT NULL,
			short_code VARCHAR(20),
			country_id INTEGER,
			type VARCHAR(30),
			sub_type VARCHAR(30),
			active BOOLEAN NOT NULL DEFAULT TRUE,
			image_path TEXT,
			category SMALLINT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		DROP TRIGGER IF EXISTS trg_competitions_updated_at ON football.competitions;
		CREATE TRIGGER trg_competitions_updated_at
		BEFORE UPDATE ON football.competitions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

		execution_status := 'SUCCESS';
		RETURN NEXT;
		v_migration_count := v_migration_count + 1;
	EXCEPTION WHEN OTHERS THEN
		execution_status := 'FAILED: ' || SQLERRM;
		execution_time := NOW();
		RETURN NEXT;
	END;

	-- V004: Football Seasons
	BEGIN
		v_version := '004';
		v_name := 'football_seasons';
		v_start_time := NOW();

		CREATE TABLE IF NOT EXISTS football.seasons (
			id SERIAL PRIMARY KEY,
			sportmonks_season_id INTEGER NOT NULL UNIQUE,
			competition_id INTEGER NOT NULL REFERENCES football.competitions(id),
			name VARCHAR(20) NOT NULL,
			starting_at DATE,
			ending_at DATE,
			is_current BOOLEAN NOT NULL DEFAULT FALSE,
			finished BOOLEAN NOT NULL DEFAULT FALSE,
			pending BOOLEAN NOT NULL DEFAULT FALSE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		DROP TRIGGER IF EXISTS trg_seasons_updated_at ON football.seasons;
		CREATE TRIGGER trg_seasons_updated_at
		BEFORE UPDATE ON football.seasons FOR EACH ROW EXECUTE FUNCTION set_updated_at();

		execution_status := 'SUCCESS';
		RETURN NEXT;
		v_migration_count := v_migration_count + 1;
	EXCEPTION WHEN OTHERS THEN
		execution_status := 'FAILED: ' || SQLERRM;
		execution_time := NOW();
		RETURN NEXT;
	END;

	-- V005: Football Teams
	BEGIN
		v_version := '005';
		v_name := 'football_teams';
		v_start_time := NOW();

		CREATE TABLE IF NOT EXISTS football.teams (
			id SERIAL PRIMARY KEY,
			sportmonks_team_id INTEGER NOT NULL UNIQUE,
			name VARCHAR(150) NOT NULL,
			short_code VARCHAR(10),
			country_id INTEGER,
			founded INTEGER,
			logo_path TEXT,
			venue_id INTEGER,
			active BOOLEAN NOT NULL DEFAULT TRUE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		DROP TRIGGER IF EXISTS trg_teams_updated_at ON football.teams;
		CREATE TRIGGER trg_teams_updated_at
		BEFORE UPDATE ON football.teams FOR EACH ROW EXECUTE FUNCTION set_updated_at();

		execution_status := 'SUCCESS';
		RETURN NEXT;
		v_migration_count := v_migration_count + 1;
	EXCEPTION WHEN OTHERS THEN
		execution_status := 'FAILED: ' || SQLERRM;
		execution_time := NOW();
		RETURN NEXT;
	END;

	-- V006: Football Players
	BEGIN
		v_version := '006';
		v_name := 'football_players';
		v_start_time := NOW();

		CREATE TABLE IF NOT EXISTS football.players (
			id SERIAL PRIMARY KEY,
			sportmonks_player_id INTEGER NOT NULL UNIQUE,
			team_id INTEGER REFERENCES football.teams(id),
			firstname VARCHAR(100) NOT NULL,
			lastname VARCHAR(100) NOT NULL,
			position VARCHAR(20),
			jersey_number SMALLINT,
			date_of_birth DATE,
			nationality VARCHAR(50),
			height VARCHAR(10),
			weight VARCHAR(10),
			image_path TEXT,
			active BOOLEAN NOT NULL DEFAULT TRUE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		DROP TRIGGER IF EXISTS trg_players_updated_at ON football.players;
		CREATE TRIGGER trg_players_updated_at
		BEFORE UPDATE ON football.players FOR EACH ROW EXECUTE FUNCTION set_updated_at();

		execution_status := 'SUCCESS';
		RETURN NEXT;
		v_migration_count := v_migration_count + 1;
	EXCEPTION WHEN OTHERS THEN
		execution_status := 'FAILED: ' || SQLERRM;
		execution_time := NOW();
		RETURN NEXT;
	END;

	-- V007: Football Fixtures
	BEGIN
		v_version := '007';
		v_name := 'football_fixtures';
		v_start_time := NOW();

		CREATE TABLE IF NOT EXISTS football.fixtures (
			id SERIAL PRIMARY KEY,
			sportmonks_fixture_id INTEGER NOT NULL UNIQUE,
			season_id INTEGER NOT NULL REFERENCES football.seasons(id),
			round SMALLINT,
			home_team_id INTEGER NOT NULL REFERENCES football.teams(id),
			away_team_id INTEGER NOT NULL REFERENCES football.teams(id),
			home_score SMALLINT,
			away_score SMALLINT,
			status VARCHAR(30),
			fixture_date TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		DROP TRIGGER IF EXISTS trg_fixtures_updated_at ON football.fixtures;
		CREATE TRIGGER trg_fixtures_updated_at
		BEFORE UPDATE ON football.fixtures FOR EACH ROW EXECUTE FUNCTION set_updated_at();

		execution_status := 'SUCCESS';
		RETURN NEXT;
		v_migration_count := v_migration_count + 1;
	EXCEPTION WHEN OTHERS THEN
		execution_status := 'FAILED: ' || SQLERRM;
		execution_time := NOW();
		RETURN NEXT;
	END;

	-- V008: Football Player Match Stats
	BEGIN
		v_version := '008';
		v_name := 'football_player_match_stats';
		v_start_time := NOW();

		CREATE TABLE IF NOT EXISTS football.player_match_stats (
			id SERIAL PRIMARY KEY,
			player_id INTEGER NOT NULL REFERENCES football.players(id),
			fixture_id INTEGER NOT NULL REFERENCES football.fixtures(id),
			minutes_played SMALLINT,
			goals SMALLINT DEFAULT 0,
			assists SMALLINT DEFAULT 0,
			yellow_cards SMALLINT DEFAULT 0,
			red_cards SMALLINT DEFAULT 0,
			clean_sheet BOOLEAN DEFAULT FALSE,
			own_goals SMALLINT DEFAULT 0,
			rating DECIMAL(3,1),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		DROP TRIGGER IF EXISTS trg_player_match_stats_updated_at ON football.player_match_stats;
		CREATE TRIGGER trg_player_match_stats_updated_at
		BEFORE UPDATE ON football.player_match_stats FOR EACH ROW EXECUTE FUNCTION set_updated_at();

		execution_status := 'SUCCESS';
		RETURN NEXT;
		v_migration_count := v_migration_count + 1;
	EXCEPTION WHEN OTHERS THEN
		execution_status := 'FAILED: ' || SQLERRM;
		execution_time := NOW();
		RETURN NEXT;
	END;

	-- V009: App Gameweeks
	BEGIN
		v_version := '009';
		v_name := 'app_gameweeks';
		v_start_time := NOW();

		CREATE TABLE IF NOT EXISTS app.gameweeks (
			id SERIAL PRIMARY KEY,
			season_id INTEGER NOT NULL REFERENCES football.seasons(id),
			gameweek_number SMALLINT NOT NULL,
			name VARCHAR(100),
			deadline TIMESTAMPTZ,
			is_active BOOLEAN NOT NULL DEFAULT FALSE,
			is_finished BOOLEAN NOT NULL DEFAULT FALSE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		DROP TRIGGER IF EXISTS trg_gameweeks_updated_at ON app.gameweeks;
		CREATE TRIGGER trg_gameweeks_updated_at
		BEFORE UPDATE ON app.gameweeks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

		execution_status := 'SUCCESS';
		RETURN NEXT;
		v_migration_count := v_migration_count + 1;
	EXCEPTION WHEN OTHERS THEN
		execution_status := 'FAILED: ' || SQLERRM;
		execution_time := NOW();
		RETURN NEXT;
	END;

	-- V010: Sync Jobs
	BEGIN
		v_version := '010';
		v_name := 'sync_jobs';
		v_start_time := NOW();

		CREATE TABLE IF NOT EXISTS sync.sync_jobs (
			id SERIAL PRIMARY KEY,
			started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			completed_at TIMESTAMPTZ,
			status VARCHAR(20) NOT NULL DEFAULT 'running',
			error_message TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		DROP TRIGGER IF EXISTS trg_sync_jobs_updated_at ON sync.sync_jobs;
		CREATE TRIGGER trg_sync_jobs_updated_at
		BEFORE UPDATE ON sync.sync_jobs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

		execution_status := 'SUCCESS';
		RETURN NEXT;
		v_migration_count := v_migration_count + 1;
	EXCEPTION WHEN OTHERS THEN
		execution_status := 'FAILED: ' || SQLERRM;
		execution_time := NOW();
		RETURN NEXT;
	END;

	-- V011: Sync Logs
	BEGIN
		v_version := '011';
		v_name := 'sync_logs';
		v_start_time := NOW();

		CREATE TABLE IF NOT EXISTS sync.sync_logs (
			id SERIAL PRIMARY KEY,
			sync_job_id INTEGER REFERENCES sync.sync_jobs(id),
			log_level VARCHAR(20),
			message TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		DROP TRIGGER IF EXISTS trg_sync_logs_updated_at ON sync.sync_logs;
		CREATE TRIGGER trg_sync_logs_updated_at
		BEFORE UPDATE ON sync.sync_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

		execution_status := 'SUCCESS';
		RETURN NEXT;
		v_migration_count := v_migration_count + 1;
	EXCEPTION WHEN OTHERS THEN
		execution_status := 'FAILED: ' || SQLERRM;
		execution_time := NOW();
		RETURN NEXT;
	END;

	-- V012: Sync Gameweek Status
	BEGIN
		v_version := '012';
		v_name := 'sync_gameweek_status';
		v_start_time := NOW();

		CREATE TABLE IF NOT EXISTS sync.sync_gameweek_status (
			id SERIAL PRIMARY KEY,
			gameweek_id INTEGER NOT NULL REFERENCES app.gameweeks(id),
			last_synced_at TIMESTAMPTZ,
			sync_status VARCHAR(20),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		DROP TRIGGER IF EXISTS trg_sync_gameweek_status_updated_at ON sync.sync_gameweek_status;
		CREATE TRIGGER trg_sync_gameweek_status_updated_at
		BEFORE UPDATE ON sync.sync_gameweek_status FOR EACH ROW EXECUTE FUNCTION set_updated_at();

		execution_status := 'SUCCESS';
		RETURN NEXT;
		v_migration_count := v_migration_count + 1;
	EXCEPTION WHEN OTHERS THEN
		execution_status := 'FAILED: ' || SQLERRM;
		execution_time := NOW();
		RETURN NEXT;
	END;

	-- V013: Football Match Events
	BEGIN
		v_version := '013';
		v_name := 'football_match_events';
		v_start_time := NOW();

		CREATE TABLE IF NOT EXISTS football.match_events (
			id SERIAL PRIMARY KEY,
			fixture_id INTEGER NOT NULL REFERENCES football.fixtures(id),
			player_id INTEGER REFERENCES football.players(id),
			team_id INTEGER NOT NULL REFERENCES football.teams(id),
			event_type VARCHAR(50) NOT NULL,
			minute SMALLINT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		DROP TRIGGER IF EXISTS trg_match_events_updated_at ON football.match_events;
		CREATE TRIGGER trg_match_events_updated_at
		BEFORE UPDATE ON football.match_events FOR EACH ROW EXECUTE FUNCTION set_updated_at();

		execution_status := 'SUCCESS';
		RETURN NEXT;
		v_migration_count := v_migration_count + 1;
	EXCEPTION WHEN OTHERS THEN
		execution_status := 'FAILED: ' || SQLERRM;
		execution_time := NOW();
		RETURN NEXT;
	END;

	-- V014: App Users
	BEGIN
		v_version := '014';
		v_name := 'app_users';
		v_start_time := NOW();

		CREATE TABLE IF NOT EXISTS app.users (
			id SERIAL PRIMARY KEY,
			email VARCHAR(255) NOT NULL UNIQUE,
			password_hash VARCHAR(500),
			firstname VARCHAR(100),
			lastname VARCHAR(100),
			is_active BOOLEAN NOT NULL DEFAULT TRUE,
			last_login TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		DROP TRIGGER IF EXISTS trg_users_updated_at ON app.users;
		CREATE TRIGGER trg_users_updated_at
		BEFORE UPDATE ON app.users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

		execution_status := 'SUCCESS';
		RETURN NEXT;
		v_migration_count := v_migration_count + 1;
	EXCEPTION WHEN OTHERS THEN
		execution_status := 'FAILED: ' || SQLERRM;
		execution_time := NOW();
		RETURN NEXT;
	END;

	-- V015: App Fantasy Teams
	BEGIN
		v_version := '015';
		v_name := 'app_fantasy_teams';
		v_start_time := NOW();

		CREATE TABLE IF NOT EXISTS app.fantasy_teams (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES app.users(id),
			season_id INTEGER NOT NULL REFERENCES football.seasons(id),
			team_name VARCHAR(255) NOT NULL,
			budget_remaining DECIMAL(10,2),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		DROP TRIGGER IF EXISTS trg_fantasy_teams_updated_at ON app.fantasy_teams;
		CREATE TRIGGER trg_fantasy_teams_updated_at
		BEFORE UPDATE ON app.fantasy_teams FOR EACH ROW EXECUTE FUNCTION set_updated_at();

		execution_status := 'SUCCESS';
		RETURN NEXT;
		v_migration_count := v_migration_count + 1;
	EXCEPTION WHEN OTHERS THEN
		execution_status := 'FAILED: ' || SQLERRM;
		execution_time := NOW();
		RETURN NEXT;
	END;

	-- V016: App Fantasy Squads
	BEGIN
		v_version := '016';
		v_name := 'app_fantasy_squads';
		v_start_time := NOW();

		CREATE TABLE IF NOT EXISTS app.fantasy_squads (
			id SERIAL PRIMARY KEY,
			fantasy_team_id INTEGER NOT NULL REFERENCES app.fantasy_teams(id),
			player_id INTEGER NOT NULL REFERENCES football.players(id),
			purchase_price DECIMAL(10,2) NOT NULL,
			gameweek_id INTEGER NOT NULL REFERENCES app.gameweeks(id),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		DROP TRIGGER IF EXISTS trg_fantasy_squads_updated_at ON app.fantasy_squads;
		CREATE TRIGGER trg_fantasy_squads_updated_at
		BEFORE UPDATE ON app.fantasy_squads FOR EACH ROW EXECUTE FUNCTION set_updated_at();

		execution_status := 'SUCCESS';
		RETURN NEXT;
		v_migration_count := v_migration_count + 1;
	EXCEPTION WHEN OTHERS THEN
		execution_status := 'FAILED: ' || SQLERRM;
		execution_time := NOW();
		RETURN NEXT;
	END;

	-- V017: App Points Results
	BEGIN
		v_version := '017';
		v_name := 'app_points_results';
		v_start_time := NOW();

		CREATE TABLE IF NOT EXISTS app.points_results (
			id SERIAL PRIMARY KEY,
			fantasy_squad_id INTEGER NOT NULL REFERENCES app.fantasy_squads(id),
			gameweek_id INTEGER NOT NULL REFERENCES app.gameweeks(id),
			points DECIMAL(10,2),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		DROP TRIGGER IF EXISTS trg_points_results_updated_at ON app.points_results;
		CREATE TRIGGER trg_points_results_updated_at
		BEFORE UPDATE ON app.points_results FOR EACH ROW EXECUTE FUNCTION set_updated_at();

		execution_status := 'SUCCESS';
		RETURN NEXT;
		v_migration_count := v_migration_count + 1;
	EXCEPTION WHEN OTHERS THEN
		execution_status := 'FAILED: ' || SQLERRM;
		execution_time := NOW();
		RETURN NEXT;
	END;

	-- V018: App Leaderboards
	BEGIN
		v_version := '018';
		v_name := 'app_leaderboards';
		v_start_time := NOW();

		CREATE TABLE IF NOT EXISTS app.leaderboards (
			id SERIAL PRIMARY KEY,
			fantasy_team_id INTEGER NOT NULL REFERENCES app.fantasy_teams(id),
			gameweek_id INTEGER NOT NULL REFERENCES app.gameweeks(id),
			total_points DECIMAL(10,2),
			rank INTEGER,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		DROP TRIGGER IF EXISTS trg_leaderboards_updated_at ON app.leaderboards;
		CREATE TRIGGER trg_leaderboards_updated_at
		BEFORE UPDATE ON app.leaderboards FOR EACH ROW EXECUTE FUNCTION set_updated_at();

		execution_status := 'SUCCESS';
		RETURN NEXT;
		v_migration_count := v_migration_count + 1;
	EXCEPTION WHEN OTHERS THEN
		execution_status := 'FAILED: ' || SQLERRM;
		execution_time := NOW();
		RETURN NEXT;
	END;

	-- V019: Final Permissions
	BEGIN
		v_version := '019';
		v_name := 'final_permissions';
		v_start_time := NOW();

		GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA football TO sync_worker_user;
		GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA sync TO sync_worker_user;
		GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA app TO sync_worker_user;

		GRANT SELECT ON ALL TABLES IN SCHEMA football TO app_api_user;
		GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA app TO app_api_user;

		execution_status := 'SUCCESS';
		RETURN NEXT;
		v_migration_count := v_migration_count + 1;
	EXCEPTION WHEN OTHERS THEN
		execution_status := 'FAILED: ' || SQLERRM;
		execution_time := NOW();
		RETURN NEXT;
	END;

	-- V020: Indexes
	BEGIN
		v_version := '020';
		v_name := 'indexes';
		v_start_time := NOW();

		CREATE INDEX IF NOT EXISTS idx_competitions_sportmonks_id ON football.competitions(sportmonks_competition_id);
		CREATE INDEX IF NOT EXISTS idx_seasons_competition_id ON football.seasons(competition_id);
		CREATE INDEX IF NOT EXISTS idx_teams_sportmonks_id ON football.teams(sportmonks_team_id);
		CREATE INDEX IF NOT EXISTS idx_players_team_id ON football.players(team_id);
		CREATE INDEX IF NOT EXISTS idx_fixtures_season_id ON football.fixtures(season_id);
		CREATE INDEX IF NOT EXISTS idx_fixtures_home_team ON football.fixtures(home_team_id);
		CREATE INDEX IF NOT EXISTS idx_fixtures_away_team ON football.fixtures(away_team_id);
		CREATE INDEX IF NOT EXISTS idx_player_match_stats_player_id ON football.player_match_stats(player_id);
		CREATE INDEX IF NOT EXISTS idx_player_match_stats_fixture_id ON football.player_match_stats(fixture_id);
		CREATE INDEX IF NOT EXISTS idx_gameweeks_season_id ON app.gameweeks(season_id);
		CREATE INDEX IF NOT EXISTS idx_fantasy_teams_user_id ON app.fantasy_teams(user_id);
		CREATE INDEX IF NOT EXISTS idx_fantasy_squads_fantasy_team ON app.fantasy_squads(fantasy_team_id);
		CREATE INDEX IF NOT EXISTS idx_fantasy_squads_player ON app.fantasy_squads(player_id);
		CREATE INDEX IF NOT EXISTS idx_users_email ON app.users(email);

		execution_status := 'SUCCESS';
		RETURN NEXT;
		v_migration_count := v_migration_count + 1;
	EXCEPTION WHEN OTHERS THEN
		execution_status := 'FAILED: ' || SQLERRM;
		execution_time := NOW();
		RETURN NEXT;
	END;

	-- V021: Football Player Lineups
	BEGIN
		v_version := '021';
		v_name := 'football_player_lineups';
		v_start_time := NOW();

		CREATE TABLE IF NOT EXISTS football.player_lineups (
			id SERIAL PRIMARY KEY,
			fixture_id INTEGER NOT NULL REFERENCES football.fixtures(id),
			player_id INTEGER NOT NULL REFERENCES football.players(id),
			team_id INTEGER NOT NULL REFERENCES football.teams(id),
			formation_position VARCHAR(50),
			is_substitute BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		DROP TRIGGER IF EXISTS trg_player_lineups_updated_at ON football.player_lineups;
		CREATE TRIGGER trg_player_lineups_updated_at
		BEFORE UPDATE ON football.player_lineups FOR EACH ROW EXECUTE FUNCTION set_updated_at();

		execution_status := 'SUCCESS';
		RETURN NEXT;
		v_migration_count := v_migration_count + 1;
	EXCEPTION WHEN OTHERS THEN
		execution_status := 'FAILED: ' || SQLERRM;
		execution_time := NOW();
		RETURN NEXT;
	END;

	-- V022: App Player Prices
	BEGIN
		v_version := '022';
		v_name := 'app_player_prices';
		v_start_time := NOW();

		CREATE TABLE IF NOT EXISTS app.player_prices (
			id SERIAL PRIMARY KEY,
			player_id INTEGER NOT NULL REFERENCES football.players(id),
			gameweek_id INTEGER NOT NULL REFERENCES app.gameweeks(id),
			price DECIMAL(10,2) NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		DROP TRIGGER IF EXISTS trg_player_prices_updated_at ON app.player_prices;
		CREATE TRIGGER trg_player_prices_updated_at
		BEFORE UPDATE ON app.player_prices FOR EACH ROW EXECUTE FUNCTION set_updated_at();

		execution_status := 'SUCCESS';
		RETURN NEXT;
		v_migration_count := v_migration_count + 1;
	EXCEPTION WHEN OTHERS THEN
		execution_status := 'FAILED: ' || SQLERRM;
		execution_time := NOW();
		RETURN NEXT;
	END;

	-- V023: App Player Price Changes
	BEGIN
		v_version := '023';
		v_name := 'app_player_price_changes';
		v_start_time := NOW();

		CREATE TABLE IF NOT EXISTS app.player_price_changes (
			id SERIAL PRIMARY KEY,
			player_price_id INTEGER NOT NULL REFERENCES app.player_prices(id),
			old_price DECIMAL(10,2),
			new_price DECIMAL(10,2),
			changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		DROP TRIGGER IF EXISTS trg_player_price_changes_updated_at ON app.player_price_changes;
		CREATE TRIGGER trg_player_price_changes_updated_at
		BEFORE UPDATE ON app.player_price_changes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

		execution_status := 'SUCCESS';
		RETURN NEXT;
		v_migration_count := v_migration_count + 1;
	EXCEPTION WHEN OTHERS THEN
		execution_status := 'FAILED: ' || SQLERRM;
		execution_time := NOW();
		RETURN NEXT;
	END;

	-- V024: Fantasy Squads Purchase Price
	BEGIN
		v_version := '024';
		v_name := 'fantasy_squads_purchase_price';
		v_start_time := NOW();

		DROP TRIGGER IF EXISTS trg_fantasy_squads_purchase_price ON app.fantasy_squads;
		CREATE TRIGGER trg_fantasy_squads_purchase_price
		BEFORE UPDATE ON app.fantasy_squads FOR EACH ROW EXECUTE FUNCTION set_updated_at();

		execution_status := 'SUCCESS';
		RETURN NEXT;
		v_migration_count := v_migration_count + 1;
	EXCEPTION WHEN OTHERS THEN
		execution_status := 'FAILED: ' || SQLERRM;
		execution_time := NOW();
		RETURN NEXT;
	END;

	-- V025: Fantasy Teams Budget
	BEGIN
		v_version := '025';
		v_name := 'fantasy_teams_budget';
		v_start_time := NOW();

		DROP TRIGGER IF EXISTS trg_fantasy_teams_budget ON app.fantasy_teams;
		CREATE TRIGGER trg_fantasy_teams_budget
		BEFORE UPDATE ON app.fantasy_teams FOR EACH ROW EXECUTE FUNCTION set_updated_at();

		execution_status := 'SUCCESS';
		execution_time := NOW();
		RETURN NEXT;
		v_migration_count := v_migration_count + 1;
	EXCEPTION WHEN OTHERS THEN
		execution_status := 'FAILED: ' || SQLERRM;
		execution_time := NOW();
		RETURN NEXT;
	END;

	RAISE NOTICE 'Database tables build completed. Total migrations executed: %', v_migration_count;

END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Helper function to get database build status
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_database_status()
RETURNS TABLE (
	schema_name NAME,
	table_count INTEGER,
	function_count INTEGER,
	index_count INTEGER
) AS $$
BEGIN
	RETURN QUERY
	SELECT 
		n.nspname::NAME,
		COUNT(DISTINCT CASE WHEN t.relkind = 'r' THEN t.oid END)::INTEGER as tables,
		COUNT(DISTINCT CASE WHEN p.prokind = 'f' THEN p.oid END)::INTEGER as functions,
		COUNT(DISTINCT CASE WHEN i.relkind = 'i' THEN i.oid END)::INTEGER as indexes
	FROM pg_namespace n
	LEFT JOIN pg_class t ON n.oid = t.relnamespace
	LEFT JOIN pg_proc p ON n.oid = p.pronamespace
	LEFT JOIN pg_class i ON n.oid = i.relnamespace AND i.relkind = 'i'
	WHERE n.nspname IN ('football', 'sync', 'app')
	GROUP BY n.nspname
	ORDER BY n.nspname;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- EXECUTION
-- ============================================================================

-- To build all tables, execute:
-- SELECT * FROM public.build_database_tables();

-- To check database build status after execution:
-- SELECT * FROM public.get_database_status();
