-- ============================================================================
-- SIMPLE TEST - Create just ONE table to test
-- ============================================================================

-- Create trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $trigger$ BEGIN
	NEW.updated_at = NOW();
	RETURN NEW;
END; $trigger$ LANGUAGE plpgsql;

-- Test table 1
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

-- Test table 2
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

-- Test table 3
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

-- Test table 4
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

-- CHECK: List tables in football schema
SELECT table_name FROM information_schema.tables WHERE table_schema = 'football';
