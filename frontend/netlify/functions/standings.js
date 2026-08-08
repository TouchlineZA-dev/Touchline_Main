import {
    jsonResponse,
    getSupabaseClient,
    selectAll,
    getCurrentSeason,
    FINAL_STATES
} from './_supabase.js';

/**
 * The league table is computed from finished fixtures rather than read from
 * football.standings.
 *
 * football.standings is populated by a sync phase we can't currently verify, so
 * deriving the table from results we know are final keeps this endpoint honest:
 * if a match isn't finished, it isn't counted. Swap to the persisted table once
 * the sync worker's standings phase is confirmed running.
 */
const emptyRow = (team) => ({
    teamId: team.id,
    team: team.name,
    shortCode: team.short_code ?? null,
    crest: team.image_path && !team.image_path.includes('placeholder') ? team.image_path : null,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    form: []
});

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
            standings: []
        });
    }

    try {
        const season = await getCurrentSeason(supabase);
        if (!season) {
            return jsonResponse(503, {
                error: 'No current PSL season is flagged is_current in football.seasons',
                standings: []
            });
        }

        const [fixtures, teams] = await Promise.all([
            selectAll(
                supabase,
                'football',
                'fixtures',
                'id,home_team_id,away_team_id,home_score,away_score,state_id,starting_at',
                (q) =>
                    q
                        .eq('season_id', season.id)
                        .in('state_id', FINAL_STATES)
                        .order('starting_at', { ascending: true })
            ),
            selectAll(supabase, 'football', 'teams', 'id,name,short_code,image_path')
        ]);

        const teamById = new Map(teams.map((t) => [t.id, t]));
        const table = new Map();

        const rowFor = (teamId) => {
            if (!table.has(teamId)) {
                const team = teamById.get(teamId);
                if (!team) return null;
                table.set(teamId, emptyRow(team));
            }
            return table.get(teamId);
        };

        for (const f of fixtures) {
            // Skip anything we can't score: placeholder fixtures with no teams,
            // or a "final" fixture that somehow has no score recorded (§9).
            if (!f.home_team_id || !f.away_team_id) continue;
            if (f.home_score === null || f.away_score === null) continue;

            const home = rowFor(f.home_team_id);
            const away = rowFor(f.away_team_id);
            if (!home || !away) continue;

            home.played += 1;
            away.played += 1;
            home.goalsFor += f.home_score;
            home.goalsAgainst += f.away_score;
            away.goalsFor += f.away_score;
            away.goalsAgainst += f.home_score;

            if (f.home_score > f.away_score) {
                home.won += 1;
                home.points += 3;
                away.lost += 1;
                home.form.push('W');
                away.form.push('L');
            } else if (f.home_score < f.away_score) {
                away.won += 1;
                away.points += 3;
                home.lost += 1;
                home.form.push('L');
                away.form.push('W');
            } else {
                home.drawn += 1;
                away.drawn += 1;
                home.points += 1;
                away.points += 1;
                home.form.push('D');
                away.form.push('D');
            }
        }

        const standings = [...table.values()]
            .map((row) => ({
                ...row,
                goalDifference: row.goalsFor - row.goalsAgainst,
                form: row.form.slice(-5)
            }))
            .sort(
                (a, b) =>
                    b.points - a.points ||
                    b.goalDifference - a.goalDifference ||
                    b.goalsFor - a.goalsFor ||
                    a.team.localeCompare(b.team)
            )
            .map((row, index) => ({ position: index + 1, ...row }));

        return jsonResponse(200, {
            season: { id: season.id, name: season.name },
            count: standings.length,
            matchesCounted: fixtures.length,
            computedFrom: 'finished-fixtures',
            standings
        });
    } catch (error) {
        console.error('standings computation failed:', error);
        return jsonResponse(500, {
            error: error.message || 'Failed to compute standings',
            standings: []
        });
    }
};
