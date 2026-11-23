import { jsonResponse, getSupabaseClient, selectAll, FINAL_STATES } from './_supabase.js';

// BACKEND_INTEGRATION.md §6 — event type ids present in the PSL/cup data.
const EVENT_TYPES = {
    10: 'VAR',
    14: 'Goal',
    15: 'Own goal',
    16: 'Penalty scored',
    17: 'Penalty missed',
    18: 'Substitution',
    19: 'Yellow card',
    20: 'Red card',
    21: 'Second yellow'
};

// Events worth rendering on a timeline; anything else is noise for a results app.
const TIMELINE_TYPES = new Set([14, 15, 16, 17, 18, 19, 20, 21]);

// Team-level stat codes. player_match_stats is team-level despite its name.
//
// The integration guide (§6) names only 11 of the 45 ids present in the data.
// The rest were identified by probing the database, and each is marked with the
// evidence. Anything still unidentified is deliberately left out: an unlabelled
// "Stat 27265" is worse for a reader than showing nothing.
//
// To replace inference with fact: GET https://api.sportmonks.com/v3/core/types
// with SPORTMONKS_API_KEY, which returns the authoritative names.
const STAT_TYPES = {
    // --- verified against events or arithmetic within the data ---
    45: 'Possession %', //  home + away = 100 in 249/250 fixtures
    52: 'Goals', //          matches counted goal events, 97%
    83: 'Red cards', //      matches red/second-yellow events, 97%
    84: 'Yellow cards', //   matches yellow events, 86%
    59: 'Substitutions', //  matches substitution events, 87%
    80: 'Passes', //         82 = 81/80 as a percentage in 492/494 cases
    81: 'Successful passes',
    82: 'Pass accuracy %',
    42: 'Shots total', //    42 = 86 + 41 + 58 in 96% of cases
    86: 'Shots on target',
    41: 'Shots off target',
    58: 'Shots blocked',

    // --- from the integration guide §6 ---
    34: 'Corners',
    51: 'Offsides',
    56: 'Fouls',
    57: 'Saves',
    79: 'Assists',

    // --- inferred: structurally consistent, standard Sportmonks naming.
    //     Confirm against /v3/core/types before treating as fact. ---
    49: 'Shots inside box', //   42 >= 49 in 100% of cases
    50: 'Shots outside box', //  49 + 50 ≈ 42 in 71% of cases
    43: 'Attacks', //            43 >= 44 in 98% of cases
    44: 'Dangerous attacks',
    // 98/99 are a total-and-subset pair (98 >= 99 in 100% of cases), but the
    // magnitudes are far too low for duels — a match shows ~11-30, not the
    // hundreds a real duel count would give. Left unlabelled rather than named
    // wrongly; crosses and successful crosses would fit the ratio.
    100: 'Interceptions',
    78: 'Tackles',
    60: 'Throw-ins',
    64: 'Hit woodwork'
};

// Display order; anything recognised but unlisted is appended after these.
const STAT_ORDER = [
    45, 42, 86, 41, 58, 49, 50, 34, 51, 56, 84, 83, 57, 80, 81, 82, 78, 100,
    43, 44, 60, 64, 79, 59, 52
];

const POSITION_NAMES = {
    24: 'GK',
    25: 'DEF',
    26: 'MID',
    27: 'ATT'
};

/**
 * Sportmonks lineup type: 11 = starting XI, 12 = bench. Anything else is
 * treated as bench so an unexpected code never inflates the starting XI.
 */
const STARTER_TYPE_ID = 11;

const isPlaceholder = (url) => !url || url.includes('placeholder');

const statusFor = (stateId) => {
    if (FINAL_STATES.includes(stateId)) return 'Finished';
    if (stateId === 22) return 'Live';
    if (stateId === 10) return 'Postponed';
    if (stateId === 12) return 'Cancelled';
    if (stateId === 15) return 'Abandoned';
    return 'Scheduled';
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
        return jsonResponse(500, { error: 'Supabase environment variables are not configured' });
    }

    const fixtureId = Number(event.queryStringParameters?.fixtureId);
    if (!Number.isInteger(fixtureId) || fixtureId <= 0) {
        return jsonResponse(400, { error: 'A numeric fixtureId query parameter is required' });
    }

    try {
        const { data: fixture, error: fixtureError } = await supabase
            .schema('football')
            .from('fixtures')
            .select(
                'id,sportmonks_fixture_id,home_team_id,away_team_id,home_score,away_score,' +
                    'home_penalty_score,away_penalty_score,state_id,starting_at,venue_id,result_info'
            )
            .eq('id', fixtureId)
            .maybeSingle();

        if (fixtureError) throw fixtureError;
        if (!fixture) {
            return jsonResponse(404, { error: `No fixture with id ${fixtureId}` });
        }

        const [teams, events, lineups, stats] = await Promise.all([
            selectAll(supabase, 'football', 'teams', 'id,name,short_code,image_path', (q) =>
                q.in('id', [fixture.home_team_id, fixture.away_team_id].filter(Boolean))
            ),
            selectAll(
                supabase,
                'football',
                'match_events',
                'id,team_id,sportmonks_player_id,sportmonks_related_player_id,player_name,' +
                    'related_player_name,type_id,minute,extra_minute,result',
                (q) => q.eq('fixture_id', fixtureId).order('minute', { ascending: true })
            ),
            selectAll(
                supabase,
                'football',
                'player_lineups',
                'id,team_id,sportmonks_player_id,jersey_number,position_id,type_id',
                (q) => q.eq('fixture_id', fixtureId)
            ),
            selectAll(supabase, 'football', 'player_match_stats', 'team_id,type_id,value,location', (q) =>
                q.eq('fixture_id', fixtureId)
            )
        ]);

        const teamById = new Map(teams.map((t) => [t.id, t]));
        const teamRef = (id) => {
            const team = teamById.get(id);
            return team
                ? {
                      id: team.id,
                      name: team.name,
                      shortCode: team.short_code,
                      crest: isPlaceholder(team.image_path) ? null : team.image_path
                  }
                : null;
        };

        // Resolve player names for events and lineups in one lookup. Events keep
        // a player_name fallback because some refs never resolve (§9).
        const sportmonksIds = [
            ...new Set(
                [
                    ...events.flatMap((e) => [e.sportmonks_player_id, e.sportmonks_related_player_id]),
                    ...lineups.map((l) => l.sportmonks_player_id)
                ].filter(Boolean)
            )
        ];

        const players = sportmonksIds.length
            ? await selectAll(
                  supabase,
                  'football',
                  'players',
                  'sportmonks_player_id,display_name,common_name,firstname,lastname,image_path',
                  (q) => q.in('sportmonks_player_id', sportmonksIds)
              )
            : [];

        const playerBySportmonksId = new Map(players.map((p) => [p.sportmonks_player_id, p]));
        const nameOf = (sportmonksId, fallback) => {
            const p = playerBySportmonksId.get(sportmonksId);
            if (!p) return fallback || null;
            return (
                p.display_name ||
                p.common_name ||
                [p.firstname, p.lastname].filter(Boolean).join(' ') ||
                fallback ||
                null
            );
        };

        const timeline = events
            .filter((e) => TIMELINE_TYPES.has(e.type_id))
            .map((e) => ({
                id: e.id,
                typeId: e.type_id,
                type: EVENT_TYPES[e.type_id] || `Type ${e.type_id}`,
                minute: e.minute,
                extraMinute: e.extra_minute,
                team: teamRef(e.team_id),
                side:
                    e.team_id === fixture.home_team_id
                        ? 'home'
                        : e.team_id === fixture.away_team_id
                          ? 'away'
                          : null,
                player: nameOf(e.sportmonks_player_id, e.player_name),
                relatedPlayer: nameOf(e.sportmonks_related_player_id, e.related_player_name),
                // Ids as well as names: the lineup view pins events to players,
                // and matching on a display name is fragile.
                sportmonksPlayerId: e.sportmonks_player_id,
                relatedSportmonksPlayerId: e.sportmonks_related_player_id,
                result: e.result
            }))
            .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0) || (a.extraMinute ?? 0) - (b.extraMinute ?? 0));

        const mapLineup = (row) => ({
            id: row.id,
            player: nameOf(row.sportmonks_player_id, null),
            sportmonksPlayerId: row.sportmonks_player_id,
            jerseyNumber: row.jersey_number,
            position: POSITION_NAMES[row.position_id] || null,
            positionId: row.position_id,
            photo: (() => {
                const p = playerBySportmonksId.get(row.sportmonks_player_id);
                return isPlaceholder(p?.image_path) ? null : p.image_path;
            })()
        });

        const lineupsFor = (teamId) => {
            const rows = lineups.filter((l) => l.team_id === teamId);
            const byNumber = (a, b) => (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99);
            return {
                starting: rows.filter((r) => r.type_id === STARTER_TYPE_ID).map(mapLineup).sort(byNumber),
                bench: rows.filter((r) => r.type_id !== STARTER_TYPE_ID).map(mapLineup).sort(byNumber)
            };
        };

        // Team stats: pair home/away values per type. Prefer team_id, fall back
        // to the location column when team_id is null.
        const statTypeIds = [...new Set(stats.map((s) => s.type_id))].sort(
            (a, b) => {
                const ia = STAT_ORDER.indexOf(a);
                const ib = STAT_ORDER.indexOf(b);
                return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
            }
        );

        const valueFor = (typeId, side) => {
            const teamId = side === 'home' ? fixture.home_team_id : fixture.away_team_id;
            const row =
                stats.find((s) => s.type_id === typeId && s.team_id === teamId) ??
                stats.find((s) => s.type_id === typeId && s.location === side);
            return row?.value ?? null;
        };

        const statistics = statTypeIds
            .filter((typeId) => STAT_TYPES[typeId])
            .map((typeId) => ({
                typeId,
                label: STAT_TYPES[typeId],
                home: valueFor(typeId, 'home'),
                away: valueFor(typeId, 'away')
            }))
            .filter((s) => s.home !== null || s.away !== null);

        // Surfaced so it is obvious when the provider adds codes we cannot name,
        // rather than them silently disappearing.
        const unlabelledStatTypes = statTypeIds.filter((typeId) => !STAT_TYPES[typeId]);

        return jsonResponse(200, {
            fixture: {
                id: fixture.id,
                sportmonksFixtureId: fixture.sportmonks_fixture_id,
                homeTeam: teamRef(fixture.home_team_id),
                awayTeam: teamRef(fixture.away_team_id),
                homeScore: fixture.home_score,
                awayScore: fixture.away_score,
                homePenaltyScore: fixture.home_penalty_score,
                awayPenaltyScore: fixture.away_penalty_score,
                kickoff: fixture.starting_at,
                stateId: fixture.state_id,
                status: statusFor(fixture.state_id),
                resultInfo: fixture.result_info
            },
            events: timeline,
            lineups: {
                home: lineupsFor(fixture.home_team_id),
                away: lineupsFor(fixture.away_team_id)
            },
            statistics,
            unlabelledStatTypes,
            // The Starter plan has no dependable per-player numbers (§9) — the
            // UI must present `statistics` as team totals, never per player.
            statisticsAreTeamLevel: true
        });
    } catch (error) {
        console.error('match details read failed:', error);
        return jsonResponse(500, { error: error.message || 'Failed to read match details' });
    }
};
