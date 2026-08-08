import {
    jsonResponse,
    getSupabaseClient,
    selectAll,
    getCurrentSeason
} from './_supabase.js';

// Sportmonks position ids — BACKEND_INTEGRATION.md §6.
const POSITION_BY_ID = {
    24: 'GK',
    25: 'DEF',
    26: 'MID',
    27: 'ATT'
};

const isPlaceholder = (url) => !url || url.includes('placeholder');

/**
 * Deterministic pseudo-random in [0,1) from an integer seed.
 *
 * The Starter plan gives no per-player ratings, so FIFA-card attributes have no
 * real source yet. Deriving them from the player id at least keeps a given
 * player's card identical across reloads — the previous implementation used
 * Math.random() at module load, so every refresh changed every player's stats.
 */
const seeded = (seed, salt) => {
    let h = (seed * 2654435761 + salt * 40503) >>> 0;
    h ^= h >>> 15;
    h = Math.imul(h, 2246822507) >>> 0;
    h ^= h >>> 13;
    return h / 4294967296;
};

const attributesFor = (playerId, position) => {
    const base = 68 + Math.floor(seeded(playerId, 1) * 14); // 68–81
    const spread = (salt, lo, hi) => {
        const v = base * (lo + seeded(playerId, salt) * (hi - lo));
        return Math.max(20, Math.min(99, Math.round(v)));
    };

    if (position === 'GK') {
        return {
            rating: base,
            pace: spread(2, 0.45, 0.6),
            shooting: spread(3, 0.2, 0.3),
            passing: spread(4, 0.6, 0.8),
            defending: spread(5, 0.9, 1.05),
            dribbling: spread(6, 0.35, 0.5),
            physical: spread(7, 0.75, 0.9)
        };
    }
    if (position === 'DEF') {
        return {
            rating: base,
            pace: spread(2, 0.75, 0.9),
            shooting: spread(3, 0.35, 0.5),
            passing: spread(4, 0.65, 0.8),
            defending: spread(5, 0.88, 1.02),
            dribbling: spread(6, 0.55, 0.7),
            physical: spread(7, 0.8, 0.95)
        };
    }
    if (position === 'MID') {
        return {
            rating: base,
            pace: spread(2, 0.75, 0.92),
            shooting: spread(3, 0.65, 0.85),
            passing: spread(4, 0.85, 1.0),
            defending: spread(5, 0.6, 0.78),
            dribbling: spread(6, 0.8, 0.98),
            physical: spread(7, 0.65, 0.82)
        };
    }
    return {
        rating: base,
        pace: spread(2, 0.85, 1.0),
        shooting: spread(3, 0.85, 1.0),
        passing: spread(4, 0.65, 0.82),
        defending: spread(5, 0.3, 0.45),
        dribbling: spread(6, 0.82, 0.98),
        physical: spread(7, 0.68, 0.85)
    };
};

/**
 * football.players has no team column, so a player's club has to be inferred
 * from who they last lined up for this season.
 */
const buildTeamIndex = async (client, seasonId) => {
    const fixtures = await selectAll(
        client,
        'football',
        'fixtures',
        'id,starting_at',
        (q) => q.eq('season_id', seasonId)
    );

    if (!fixtures.length) return new Map();

    const kickoffById = new Map(
        fixtures.map((f) => [f.id, f.starting_at ? Date.parse(f.starting_at) : 0])
    );

    const lineups = await selectAll(
        client,
        'football',
        'player_lineups',
        'sportmonks_player_id,team_id,fixture_id',
        (q) => q.in('fixture_id', [...kickoffById.keys()])
    );

    const latest = new Map(); // sportmonks_player_id -> { teamId, kickoff }
    for (const row of lineups) {
        if (!row.sportmonks_player_id || !row.team_id) continue;

        const kickoff = kickoffById.get(row.fixture_id) ?? 0;
        const seen = latest.get(row.sportmonks_player_id);
        if (!seen || kickoff > seen.kickoff) {
            latest.set(row.sportmonks_player_id, { teamId: row.team_id, kickoff });
        }
    }

    return latest;
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
            players: []
        });
    }

    try {
        const season = await getCurrentSeason(supabase);
        if (!season) {
            return jsonResponse(503, {
                error: 'No current PSL season is flagged is_current in football.seasons',
                players: []
            });
        }

        const [players, prices, teams, teamIndex] = await Promise.all([
            selectAll(
                supabase,
                'football',
                'players',
                'id,sportmonks_player_id,display_name,common_name,firstname,lastname,position_id,image_path,nationality_id'
            ),
            selectAll(supabase, 'app', 'player_prices', 'player_id,price', (q) =>
                q.eq('season_id', season.id)
            ),
            selectAll(supabase, 'football', 'teams', 'id,name,short_code,image_path'),
            buildTeamIndex(supabase, season.id)
        ]);

        const priceById = new Map(prices.map((p) => [p.player_id, Number(p.price)]));
        const teamById = new Map(teams.map((t) => [t.id, t]));

        const payload = players.map((p) => {
            const position = POSITION_BY_ID[p.position_id] || 'MID';
            const team = teamById.get(teamIndex.get(p.sportmonks_player_id)?.teamId);
            const name =
                p.display_name ||
                p.common_name ||
                [p.firstname, p.lastname].filter(Boolean).join(' ') ||
                'Unknown player';

            return {
                id: p.id, // internal football.players.id — what app tables reference
                sportmonksPlayerId: p.sportmonks_player_id,
                name,
                position,
                team: team?.name ?? null,
                teamId: team?.id ?? null,
                teamCrest: isPlaceholder(team?.image_path) ? null : team.image_path,
                nationalityId: p.nationality_id,
                imageUrl: isPlaceholder(p.image_path) ? null : p.image_path,
                price: priceById.get(p.id) ?? 50.0,
                ...attributesFor(p.id, position)
            };
        });

        return jsonResponse(200, {
            season: { id: season.id, name: season.name },
            count: payload.length,
            players: payload
        });
    } catch (error) {
        console.error('players read failed:', error);
        return jsonResponse(500, {
            error: error.message || 'Failed to read players',
            players: []
        });
    }
};
