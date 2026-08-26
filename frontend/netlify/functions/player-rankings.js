import {
    jsonResponse,
    getSupabaseClient,
    selectAll,
    PSL_COMPETITION_ID,
    FINAL_STATES
} from './_supabase.js';

const GOAL_EVENT_TYPES = new Set([14, 16]);
const DEFENSIVE_POSITION_IDS = new Set([24, 25]);
const STARTER_TYPE_ID = 11;

const playerName = (player) =>
    player?.display_name ||
    player?.common_name ||
    [player?.firstname, player?.lastname].filter(Boolean).join(' ') ||
    'Unknown player';

const toNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

const rankRows = (rows) =>
    rows
        .filter((row) => row.total > 0)
        .sort((a, b) => b.total - a.total || a.player.localeCompare(b.player))
        .slice(0, 10)
        .map((row, index) => ({ rank: index + 1, ...row }));

const buildRankingRow = (player, team, total) => ({
    playerId: player.id,
    sportmonksPlayerId: player.sportmonks_player_id,
    player: playerName(player),
    jerseyNumber: player.jersey_number ?? null,
    club: team?.name ?? null,
    clubId: team?.id ?? null,
    total
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
            rankings: { goals: [], assists: [], cleanSheets: [] }
        });
    }

    try {
        const requestedCompetition = toNumber(event.queryStringParameters?.competitionId);
        const requestedSeason = toNumber(event.queryStringParameters?.seasonId);

        const competitions = await selectAll(
            supabase,
            'football',
            'competitions',
            'id,sportmonks_competition_id,name,short_code,active',
            (q) => q.order('name', { ascending: true })
        );

        const selectedCompetition =
            competitions.find((competition) =>
                requestedCompetition
                    ? competition.sportmonks_competition_id === requestedCompetition ||
                      competition.id === requestedCompetition
                    : competition.sportmonks_competition_id === PSL_COMPETITION_ID
            ) ??
            competitions.find((competition) => competition.active) ??
            competitions[0];

        if (!selectedCompetition) {
            return jsonResponse(503, {
                error: 'No football competitions are available',
                rankings: { goals: [], assists: [], cleanSheets: [] }
            });
        }

        const seasons = await selectAll(
            supabase,
            'football',
            'seasons',
            'id,sportmonks_season_id,competition_id,name,starting_at,ending_at,is_current,finished,pending',
            (q) =>
                q
                    .eq('competition_id', selectedCompetition.id)
                    .order('starting_at', { ascending: false })
        );

        const selectedSeason =
            seasons.find((season) =>
                requestedSeason
                    ? season.id === requestedSeason || season.sportmonks_season_id === requestedSeason
                    : season.is_current
            ) ?? seasons[0];

        if (!selectedSeason) {
            return jsonResponse(503, {
                error: 'No seasons are available for this competition',
                competition: {
                    id: selectedCompetition.id,
                    sportmonksCompetitionId: selectedCompetition.sportmonks_competition_id,
                    name: selectedCompetition.name
                },
                seasons: [],
                rankings: { goals: [], assists: [], cleanSheets: [] }
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
                        .eq('competition_id', selectedCompetition.id)
                        .eq('season_id', selectedSeason.id)
                        .in('state_id', FINAL_STATES)
                        .order('starting_at', { ascending: true })
            ),
            selectAll(supabase, 'football', 'teams', 'id,name,short_code')
        ]);

        const validFixtures = fixtures.filter(
            (fixture) =>
                fixture.home_team_id &&
                fixture.away_team_id &&
                fixture.home_score !== null &&
                fixture.away_score !== null
        );

        const fixtureIds = validFixtures.map((fixture) => fixture.id);
        const [events, lineups] = fixtureIds.length
            ? await Promise.all([
                  selectAll(
                      supabase,
                      'football',
                      'match_events',
                      'fixture_id,team_id,sportmonks_player_id,sportmonks_related_player_id,type_id',
                      (q) => q.in('fixture_id', fixtureIds)
                  ),
                  selectAll(
                      supabase,
                      'football',
                      'player_lineups',
                      'fixture_id,team_id,sportmonks_player_id,jersey_number,position_id,type_id',
                      (q) => q.in('fixture_id', fixtureIds)
                  )
              ])
            : [[], []];

        const sportmonksPlayerIds = [
            ...new Set(
                [
                    ...events.flatMap((eventRow) => [
                        eventRow.sportmonks_player_id,
                        eventRow.sportmonks_related_player_id
                    ]),
                    ...lineups.map((lineup) => lineup.sportmonks_player_id)
                ].filter(Boolean)
            )
        ];

        const players = sportmonksPlayerIds.length
            ? await selectAll(
                  supabase,
                  'football',
                  'players',
                  'id,sportmonks_player_id,display_name,common_name,firstname,lastname',
                  (q) => q.in('sportmonks_player_id', sportmonksPlayerIds)
              )
            : [];

        const playerBySportmonksId = new Map(players.map((player) => [player.sportmonks_player_id, player]));
        const teamById = new Map(teams.map((team) => [team.id, team]));
        const fixtureById = new Map(validFixtures.map((fixture) => [fixture.id, fixture]));
        const latestLineupByPlayer = new Map();

        for (const lineup of lineups) {
            if (!lineup.sportmonks_player_id) continue;
            const fixture = fixtureById.get(lineup.fixture_id);
            const kickoff = fixture?.starting_at ? Date.parse(fixture.starting_at) : 0;
            const current = latestLineupByPlayer.get(lineup.sportmonks_player_id);
            if (!current || kickoff >= current.kickoff) {
                latestLineupByPlayer.set(lineup.sportmonks_player_id, { ...lineup, kickoff });
            }
        }

        const goals = new Map();
        const assists = new Map();

        for (const eventRow of events) {
            if (!GOAL_EVENT_TYPES.has(eventRow.type_id)) continue;

            if (eventRow.sportmonks_player_id) {
                goals.set(
                    eventRow.sportmonks_player_id,
                    (goals.get(eventRow.sportmonks_player_id) ?? 0) + 1
                );
            }

            if (
                eventRow.sportmonks_related_player_id &&
                eventRow.sportmonks_related_player_id !== eventRow.sportmonks_player_id
            ) {
                assists.set(
                    eventRow.sportmonks_related_player_id,
                    (assists.get(eventRow.sportmonks_related_player_id) ?? 0) + 1
                );
            }
        }

        const cleanSheets = new Map();
        const seenCleanSheetAppearances = new Set();

        for (const lineup of lineups) {
            if (
                lineup.type_id !== STARTER_TYPE_ID ||
                !DEFENSIVE_POSITION_IDS.has(lineup.position_id) ||
                !lineup.sportmonks_player_id
            ) {
                continue;
            }

            const fixture = fixtureById.get(lineup.fixture_id);
            if (!fixture) continue;

            const conceded =
                lineup.team_id === fixture.home_team_id
                    ? fixture.away_score
                    : lineup.team_id === fixture.away_team_id
                      ? fixture.home_score
                      : null;

            if (conceded !== 0) continue;

            const dedupeKey = `${lineup.fixture_id}:${lineup.sportmonks_player_id}`;
            if (seenCleanSheetAppearances.has(dedupeKey)) continue;
            seenCleanSheetAppearances.add(dedupeKey);
            cleanSheets.set(
                lineup.sportmonks_player_id,
                (cleanSheets.get(lineup.sportmonks_player_id) ?? 0) + 1
            );
        }

        const rowsFromMap = (totals) =>
            [...totals.entries()]
                .map(([sportmonksPlayerId, total]) => {
                    const player = playerBySportmonksId.get(sportmonksPlayerId);
                    if (!player) return null;
                    const latestLineup = latestLineupByPlayer.get(sportmonksPlayerId);
                    return buildRankingRow(player, teamById.get(latestLineup?.team_id), total);
                })
                .filter(Boolean);

        return jsonResponse(200, {
            competition: {
                id: selectedCompetition.id,
                sportmonksCompetitionId: selectedCompetition.sportmonks_competition_id,
                name: selectedCompetition.name,
                shortCode: selectedCompetition.short_code
            },
            competitions: competitions.map((competition) => ({
                id: competition.id,
                sportmonksCompetitionId: competition.sportmonks_competition_id,
                name: competition.name,
                shortCode: competition.short_code,
                active: competition.active
            })),
            season: {
                id: selectedSeason.id,
                sportmonksSeasonId: selectedSeason.sportmonks_season_id,
                name: selectedSeason.name,
                isCurrent: selectedSeason.is_current
            },
            seasons: seasons.map((season) => ({
                id: season.id,
                sportmonksSeasonId: season.sportmonks_season_id,
                name: season.name,
                isCurrent: season.is_current,
                finished: season.finished,
                pending: season.pending
            })),
            matchesCounted: validFixtures.length,
            rankings: {
                goals: rankRows(rowsFromMap(goals)),
                assists: rankRows(rowsFromMap(assists)),
                cleanSheets: rankRows(rowsFromMap(cleanSheets))
            }
        });
    } catch (error) {
        console.error('player rankings read failed:', error);
        return jsonResponse(500, {
            error: error.message || 'Failed to compute player rankings',
            rankings: { goals: [], assists: [], cleanSheets: [] }
        });
    }
};
