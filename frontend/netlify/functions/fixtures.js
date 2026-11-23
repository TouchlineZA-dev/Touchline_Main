import {
    jsonResponse,
    getSupabaseClient,
    selectAll,
    getCurrentSeason,
    FINAL_STATES
} from './_supabase.js';

// BACKEND_INTEGRATION.md §6 — only 5/7/8 mean the result is final.
const statusFor = (stateId) => {
    if (FINAL_STATES.includes(stateId)) return 'Finished';
    if (stateId === 22) return 'Live';
    if ([10, 12, 15].includes(stateId)) return 'No result';
    return 'Scheduled';
};

const GOAL_EVENT_TYPES = new Set([14, 15, 16]);
const GOAL_EVENT_LABELS = {
    14: 'Goal',
    15: 'Own goal',
    16: 'Penalty scored'
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return jsonResponse(204, {});
    }
    if (event.httpMethod !== 'GET') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
        return jsonResponse(500, {
            error: 'Supabase environment variables are not configured',
            fixtures: []
        });
    }

    try {
        const season = await getCurrentSeason(supabase);
        if (!season) {
            return jsonResponse(503, {
                error: 'No current PSL season is flagged is_current in football.seasons',
                fixtures: []
            });
        }

        const { from, to } = event.queryStringParameters || {};

        const [rows, teams] = await Promise.all([
            selectAll(
                supabase,
                'football',
                'fixtures',
                'id,sportmonks_fixture_id,home_team_id,away_team_id,home_score,away_score,state_id,starting_at,venue_id',
                (q) => {
                    let query = q.eq('season_id', season.id).order('starting_at', { ascending: true });
                    if (from) query = query.gte('starting_at', from);
                    if (to) query = query.lte('starting_at', to);
                    return query;
                }
            ),
            selectAll(supabase, 'football', 'teams', 'id,name,short_code,image_path')
        ]);

        const teamById = new Map(teams.map((t) => [t.id, t]));
        const nameOf = (id) => teamById.get(id)?.name ?? 'TBD';
        const fixtureIds = rows.map((f) => f.id).filter(Boolean);

        const events = fixtureIds.length
            ? await selectAll(
                  supabase,
                  'football',
                  'match_events',
                  'fixture_id,team_id,sportmonks_player_id,player_name,type_id,minute,extra_minute',
                  (q) =>
                      q
                          .in('fixture_id', fixtureIds)
                          .in('type_id', [...GOAL_EVENT_TYPES])
                          .order('minute', { ascending: true })
              )
            : [];

        const playerIds = [
            ...new Set(events.map((eventRow) => eventRow.sportmonks_player_id).filter(Boolean))
        ];

        const players = playerIds.length
            ? await selectAll(
                  supabase,
                  'football',
                  'players',
                  'sportmonks_player_id,display_name,common_name,firstname,lastname',
                  (q) => q.in('sportmonks_player_id', playerIds)
              )
            : [];

        const playerBySportmonksId = new Map(players.map((p) => [p.sportmonks_player_id, p]));
        const playerName = (sportmonksId, fallback) => {
            const player = playerBySportmonksId.get(sportmonksId);
            return (
                player?.display_name ||
                player?.common_name ||
                [player?.firstname, player?.lastname].filter(Boolean).join(' ') ||
                fallback ||
                null
            );
        };

        const scorersByFixtureId = new Map();
        for (const eventRow of events) {
            if (!GOAL_EVENT_TYPES.has(eventRow.type_id)) continue;
            if (!scorersByFixtureId.has(eventRow.fixture_id)) {
                scorersByFixtureId.set(eventRow.fixture_id, []);
            }

            const fixture = rows.find((row) => row.id === eventRow.fixture_id);
            scorersByFixtureId.get(eventRow.fixture_id).push({
                minute: eventRow.minute,
                extraMinute: eventRow.extra_minute,
                player: playerName(eventRow.sportmonks_player_id, eventRow.player_name),
                teamId: eventRow.team_id,
                side:
                    eventRow.team_id === fixture?.home_team_id
                        ? 'home'
                        : eventRow.team_id === fixture?.away_team_id
                          ? 'away'
                          : null,
                type: GOAL_EVENT_LABELS[eventRow.type_id] || 'Goal'
            });
        }

        const fixtures = rows.map((f) => ({
            id: f.id,
            sportmonksFixtureId: f.sportmonks_fixture_id,
            homeTeam: nameOf(f.home_team_id),
            awayTeam: nameOf(f.away_team_id),
            homeTeamId: f.home_team_id,
            awayTeamId: f.away_team_id,
            homeCrest: teamById.get(f.home_team_id)?.image_path ?? null,
            awayCrest: teamById.get(f.away_team_id)?.image_path ?? null,
            homeScore: f.home_score,
            awayScore: f.away_score,
            // Times are stored UTC; the UI renders them in SAST.
            kickoff: f.starting_at,
            stateId: f.state_id,
            status: statusFor(f.state_id),
            scorers: scorersByFixtureId.get(f.id) ?? []
        }));

        return jsonResponse(200, {
            season: { id: season.id, name: season.name },
            count: fixtures.length,
            fixtures
        });
    } catch (error) {
        console.error('fixtures read failed:', error);
        return jsonResponse(500, {
            error: error.message || 'Failed to read fixtures',
            fixtures: []
        });
    }
};
