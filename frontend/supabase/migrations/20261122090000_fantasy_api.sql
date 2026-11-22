-- Persistent fantasy teams and private league membership.
-- Mutations are performed through the authenticated Netlify API and the
-- service-role-only functions below; direct client access stays disabled.

CREATE TABLE IF NOT EXISTS app.fantasy_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_id bigint NOT NULL REFERENCES football.seasons(id) ON DELETE CASCADE,
  team_name text NOT NULL CHECK (length(trim(team_name)) BETWEEN 1 AND 40),
  formation text NOT NULL CHECK (formation IN ('4-4-2', '4-3-3', '3-5-2', '3-4-3', '5-3-2')),
  budget_remaining numeric(6,1) NOT NULL DEFAULT 300.0 CHECK (budget_remaining BETWEEN 0 AND 300),
  total_points integer NOT NULL DEFAULT 0,
  gameweek_points integer NOT NULL DEFAULT 0,
  active_chip text CHECK (active_chip IN ('bench_boost', 'triple_captain', 'wildcard')),
  used_chips text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_auth_user_id, season_id)
);

CREATE TABLE IF NOT EXISTS app.fantasy_team_picks (
  team_id uuid NOT NULL REFERENCES app.fantasy_teams(id) ON DELETE CASCADE,
  player_id bigint NOT NULL REFERENCES football.players(id) ON DELETE RESTRICT,
  slot smallint NOT NULL CHECK (slot BETWEEN 0 AND 14),
  is_captain boolean NOT NULL DEFAULT false,
  is_vice_captain boolean NOT NULL DEFAULT false,
  is_bench boolean NOT NULL DEFAULT false,
  PRIMARY KEY (team_id, player_id),
  UNIQUE (team_id, slot),
  CHECK (NOT (is_captain AND is_vice_captain)),
  CHECK ((slot >= 11) = is_bench)
);

CREATE TABLE IF NOT EXISTS app.fantasy_gameweek_scores (
  team_id uuid NOT NULL REFERENCES app.fantasy_teams(id) ON DELETE CASCADE,
  gameweek integer NOT NULL CHECK (gameweek > 0),
  points integer NOT NULL DEFAULT 0,
  is_final boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, gameweek)
);

CREATE TABLE IF NOT EXISTS app.fantasy_leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id bigint NOT NULL REFERENCES football.seasons(id) ON DELETE CASCADE,
  owner_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 50),
  join_code text NOT NULL UNIQUE CHECK (length(join_code) = 8),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.fantasy_league_members (
  league_id uuid NOT NULL REFERENCES app.fantasy_leagues(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES app.fantasy_teams(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, auth_user_id)
);

CREATE INDEX IF NOT EXISTS fantasy_team_picks_team_idx ON app.fantasy_team_picks(team_id);
CREATE INDEX IF NOT EXISTS fantasy_league_members_team_idx ON app.fantasy_league_members(team_id);
CREATE INDEX IF NOT EXISTS fantasy_scores_week_idx ON app.fantasy_gameweek_scores(gameweek, team_id);

ALTER TABLE app.fantasy_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.fantasy_team_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.fantasy_gameweek_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.fantasy_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.fantasy_league_members ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA app TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON app.fantasy_teams,
  app.fantasy_team_picks, app.fantasy_gameweek_scores,
  app.fantasy_leagues, app.fantasy_league_members TO service_role;

-- Execute through the verified server API only. The API verifies Supabase JWTs
-- before supplying the authenticated user ID to these service-role functions.
CREATE OR REPLACE FUNCTION app.save_fantasy_team(
  p_user_id uuid,
  p_season_id bigint,
  p_team_name text,
  p_formation text,
  p_picks jsonb
) RETURNS app.fantasy_teams
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public, football
AS $$
DECLARE
  v_team app.fantasy_teams;
  v_pick_count integer;
  v_unique_players integer;
  v_unique_slots integer;
  v_captains integer;
  v_vice_captains integer;
  v_starters integer;
  v_goalkeepers integer;
  v_defenders integer;
  v_midfielders integer;
  v_attackers integer;
  v_bench_gk integer;
  v_bench_def integer;
  v_bench_mid integer;
  v_bench_att integer;
  v_cost numeric;
  v_clubless integer;
  v_over_limit integer;
  v_expected_def integer;
  v_expected_mid integer;
  v_expected_att integer;
BEGIN
  IF p_team_name IS NULL OR length(trim(p_team_name)) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'Team name must be between 1 and 40 characters';
  END IF;
  IF p_formation NOT IN ('4-4-2', '4-3-3', '3-5-2', '3-4-3', '5-3-2') THEN
    RAISE EXCEPTION 'Unsupported formation';
  END IF;
  IF jsonb_typeof(p_picks) <> 'array' THEN
    RAISE EXCEPTION 'Picks must be an array';
  END IF;

  SELECT count(*), count(DISTINCT (x->>'playerId')::bigint),
         count(DISTINCT (x->>'slot')::integer),
         count(*) FILTER (WHERE (x->>'isCaptain')::boolean),
         count(*) FILTER (WHERE (x->>'isViceCaptain')::boolean),
         count(*) FILTER (WHERE NOT (x->>'isBench')::boolean),
         count(*) FILTER (WHERE pl.position_id = 24),
         count(*) FILTER (WHERE pl.position_id = 25),
         count(*) FILTER (WHERE pl.position_id = 26),
         count(*) FILTER (WHERE pl.position_id = 27),
         count(*) FILTER (WHERE (x->>'isBench')::boolean AND pl.position_id = 24),
         count(*) FILTER (WHERE (x->>'isBench')::boolean AND pl.position_id = 25),
         count(*) FILTER (WHERE (x->>'isBench')::boolean AND pl.position_id = 26),
         count(*) FILTER (WHERE (x->>'isBench')::boolean AND pl.position_id = 27),
         coalesce(sum(pp.price), 0)
    INTO v_pick_count, v_unique_players, v_unique_slots, v_captains,
         v_vice_captains, v_starters, v_goalkeepers, v_defenders,
         v_midfielders, v_attackers, v_bench_gk, v_bench_def,
         v_bench_mid, v_bench_att, v_cost
    FROM jsonb_array_elements(p_picks) x
    JOIN football.players pl ON pl.id = (x->>'playerId')::bigint
    JOIN app.player_prices pp ON pp.player_id = pl.id AND pp.season_id = p_season_id;

  IF v_pick_count <> 15 OR v_unique_players <> 15 OR v_unique_slots <> 15 THEN
    RAISE EXCEPTION 'Squad needs 15 different priced players in unique slots';
  END IF;
  IF v_captains <> 1 OR v_vice_captains <> 1 OR v_starters <> 11 THEN
    RAISE EXCEPTION 'Choose 11 starters, one captain, and one vice-captain';
  END IF;
  IF v_goalkeepers <> 2 OR v_defenders <> 5 OR v_midfielders <> 5 OR v_attackers <> 3
     OR v_bench_gk <> 1 OR v_bench_def <> 1 OR v_bench_mid <> 1 OR v_bench_att <> 1 THEN
    RAISE EXCEPTION 'Squad requires 2 GK, 5 DEF, 5 MID, 3 ATT and one of each position on the bench';
  END IF;
  IF v_cost > 300 THEN RAISE EXCEPTION 'Squad is over the 300.0 budget'; END IF;

  CASE p_formation
    WHEN '4-4-2' THEN v_expected_def := 4; v_expected_mid := 4; v_expected_att := 2;
    WHEN '4-3-3' THEN v_expected_def := 4; v_expected_mid := 3; v_expected_att := 3;
    WHEN '3-5-2' THEN v_expected_def := 3; v_expected_mid := 5; v_expected_att := 2;
    WHEN '3-4-3' THEN v_expected_def := 3; v_expected_mid := 4; v_expected_att := 3;
    WHEN '5-3-2' THEN v_expected_def := 5; v_expected_mid := 3; v_expected_att := 2;
  END CASE;
  IF (SELECT count(*) FROM jsonb_array_elements(p_picks) x
      JOIN football.players pl ON pl.id = (x->>'playerId')::bigint
      WHERE NOT (x->>'isBench')::boolean AND pl.position_id = 25) <> v_expected_def
     OR (SELECT count(*) FROM jsonb_array_elements(p_picks) x
      JOIN football.players pl ON pl.id = (x->>'playerId')::bigint
      WHERE NOT (x->>'isBench')::boolean AND pl.position_id = 26) <> v_expected_mid
     OR (SELECT count(*) FROM jsonb_array_elements(p_picks) x
      JOIN football.players pl ON pl.id = (x->>'playerId')::bigint
      WHERE NOT (x->>'isBench')::boolean AND pl.position_id = 27) <> v_expected_att THEN
    RAISE EXCEPTION 'Starting lineup does not match selected formation';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_picks) x
      WHERE ((x->>'slot')::integer BETWEEN 0 AND 10) = (x->>'isBench')::boolean
         OR (x->>'isCaptain')::boolean AND (x->>'isBench')::boolean
         OR (x->>'isViceCaptain')::boolean AND (x->>'isBench')::boolean) THEN
    RAISE EXCEPTION 'Starting and bench slots or captain assignments are invalid';
  END IF;

  WITH selected AS (
    SELECT pl.id, pl.sportmonks_player_id
    FROM jsonb_array_elements(p_picks) x
    JOIN football.players pl ON pl.id = (x->>'playerId')::bigint
  ), latest_clubs AS (
    SELECT DISTINCT ON (lineup.sportmonks_player_id)
           lineup.sportmonks_player_id, lineup.team_id
    FROM football.player_lineups lineup
    JOIN football.fixtures fixture ON fixture.id = lineup.fixture_id
    WHERE fixture.season_id = p_season_id
      AND lineup.sportmonks_player_id IN (SELECT sportmonks_player_id FROM selected)
    ORDER BY lineup.sportmonks_player_id, fixture.starting_at DESC
  ), club_counts AS (
    SELECT latest_clubs.team_id, count(*) AS players
    FROM selected JOIN latest_clubs USING (sportmonks_player_id)
    GROUP BY latest_clubs.team_id
  )
  SELECT (SELECT count(*) FROM selected LEFT JOIN latest_clubs USING (sportmonks_player_id)
          WHERE latest_clubs.team_id IS NULL),
         (SELECT count(*) FROM club_counts WHERE players > 3)
    INTO v_clubless, v_over_limit;
  IF v_clubless > 0 THEN RAISE EXCEPTION 'Every selected player needs a known PSL club'; END IF;
  IF v_over_limit > 0 THEN RAISE EXCEPTION 'Maximum 3 players allowed from each PSL club'; END IF;

  INSERT INTO app.fantasy_teams (owner_auth_user_id, season_id, team_name, formation, budget_remaining)
  VALUES (p_user_id, p_season_id, trim(p_team_name), p_formation, 300 - v_cost)
  ON CONFLICT (owner_auth_user_id, season_id) DO UPDATE
    SET team_name = EXCLUDED.team_name,
        formation = EXCLUDED.formation,
        budget_remaining = EXCLUDED.budget_remaining,
        updated_at = now()
  RETURNING * INTO v_team;

  DELETE FROM app.fantasy_team_picks WHERE team_id = v_team.id;
  INSERT INTO app.fantasy_team_picks (team_id, player_id, slot, is_captain, is_vice_captain, is_bench)
  SELECT v_team.id, (x->>'playerId')::bigint, (x->>'slot')::smallint,
         (x->>'isCaptain')::boolean, (x->>'isViceCaptain')::boolean, (x->>'isBench')::boolean
  FROM jsonb_array_elements(p_picks) x;

  RETURN v_team;
END;
$$;

CREATE OR REPLACE FUNCTION app.create_fantasy_league(
  p_user_id uuid, p_season_id bigint, p_name text, p_join_code text
) RETURNS app.fantasy_leagues
LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, public
AS $$
DECLARE v_team app.fantasy_teams; v_league app.fantasy_leagues;
BEGIN
  SELECT * INTO v_team FROM app.fantasy_teams
    WHERE owner_auth_user_id = p_user_id AND season_id = p_season_id;
  IF v_team.id IS NULL THEN RAISE EXCEPTION 'Create a fantasy team before creating a league'; END IF;
  INSERT INTO app.fantasy_leagues (season_id, owner_auth_user_id, name, join_code)
    VALUES (p_season_id, p_user_id, trim(p_name), upper(p_join_code)) RETURNING * INTO v_league;
  INSERT INTO app.fantasy_league_members (league_id, auth_user_id, team_id)
    VALUES (v_league.id, p_user_id, v_team.id);
  RETURN v_league;
END;
$$;

CREATE OR REPLACE FUNCTION app.join_fantasy_league(p_user_id uuid, p_join_code text)
RETURNS app.fantasy_league_members
LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, public
AS $$
DECLARE v_league app.fantasy_leagues; v_team app.fantasy_teams; v_member app.fantasy_league_members;
BEGIN
  SELECT * INTO v_league FROM app.fantasy_leagues
    WHERE join_code = upper(trim(p_join_code)) FOR UPDATE;
  IF v_league.id IS NULL THEN RAISE EXCEPTION 'League code not found'; END IF;
  SELECT * INTO v_team FROM app.fantasy_teams
    WHERE owner_auth_user_id = p_user_id AND season_id = v_league.season_id;
  IF v_team.id IS NULL THEN RAISE EXCEPTION 'Create a fantasy team before joining a league'; END IF;
  IF EXISTS (SELECT 1 FROM app.fantasy_league_members
      WHERE league_id = v_league.id AND auth_user_id = p_user_id) THEN
    RAISE EXCEPTION 'Already a member of this league';
  END IF;
  IF (SELECT count(*) FROM app.fantasy_league_members WHERE league_id = v_league.id) >= 20 THEN
    RAISE EXCEPTION 'League is full (maximum 20 members)';
  END IF;
  INSERT INTO app.fantasy_league_members (league_id, auth_user_id, team_id)
    VALUES (v_league.id, p_user_id, v_team.id) RETURNING * INTO v_member;
  RETURN v_member;
END;
$$;

CREATE OR REPLACE FUNCTION app.activate_fantasy_chip(
  p_user_id uuid, p_season_id bigint, p_chip text
) RETURNS app.fantasy_teams
LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, public
AS $$
DECLARE v_team app.fantasy_teams;
BEGIN
  IF p_chip NOT IN ('bench_boost', 'triple_captain', 'wildcard') THEN
    RAISE EXCEPTION 'Unknown fantasy chip';
  END IF;
  SELECT * INTO v_team FROM app.fantasy_teams
    WHERE owner_auth_user_id = p_user_id AND season_id = p_season_id FOR UPDATE;
  IF v_team.id IS NULL THEN RAISE EXCEPTION 'Create a fantasy team before playing a chip'; END IF;
  IF v_team.active_chip IS NOT NULL THEN RAISE EXCEPTION 'A chip is already active'; END IF;
  UPDATE app.fantasy_teams
    SET active_chip = p_chip,
        used_chips = CASE WHEN p_chip = ANY(used_chips) THEN used_chips ELSE array_append(used_chips, p_chip) END,
        updated_at = now()
    WHERE id = v_team.id
    RETURNING * INTO v_team;
  RETURN v_team;
END;
$$;

REVOKE ALL ON FUNCTION app.save_fantasy_team(uuid,bigint,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.create_fantasy_league(uuid,bigint,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.join_fantasy_league(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.activate_fantasy_chip(uuid,bigint,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.save_fantasy_team(uuid,bigint,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION app.create_fantasy_league(uuid,bigint,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION app.join_fantasy_league(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION app.activate_fantasy_chip(uuid,bigint,text) TO service_role;

