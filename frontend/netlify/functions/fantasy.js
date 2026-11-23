import { randomBytes } from 'node:crypto';
import {
    getCurrentSeason,
    getSupabaseClient,
    jsonResponse,
    selectAll
} from './_supabase.js';

const POSITION_BY_ID = { 24: 'GK', 25: 'DEF', 26: 'MID', 27: 'ATT' };
const FORMATIONS = new Set(['4-4-2', '4-3-3', '3-5-2', '3-4-3', '5-3-2']);

const response = (status, body) => ({
    ...jsonResponse(status, body),
    headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
        'Content-Type': 'application/json'
    }
});

const parseBody = (event) => {
    try {
        return JSON.parse(event.body || '{}');
    } catch {
        return null;
    }
};

const currentSeason = async (supabase) => {
    const season = await getCurrentSeason(supabase);
    if (!season) {
        const error = new Error('No current PSL season is configured');
        error.statusCode = 503;
        throw error;
    }
    return season;
};

const getPicks = async (supabase, teamId, seasonId) => {
    const { data: picks, error } = await supabase.schema('app')
        .from('fantasy_team_picks')
        .select('player_id,slot,is_captain,is_vice_captain,is_bench')
        .eq('team_id', teamId)
        .order('slot');
    if (error) throw error;
    if (!picks?.length) return [];

    const ids = picks.map((pick) => pick.player_id);
    const [players, prices, teams, fixtures] = await Promise.all([
        selectAll(supabase, 'football', 'players',
            'id,sportmonks_player_id,display_name,common_name,firstname,lastname,position_id,image_path,nationality_id',
            (q) => q.in('id', ids)),
        selectAll(supabase, 'app', 'player_prices', 'player_id,price',
            (q) => q.eq('season_id', seasonId).in('player_id', ids)),
        selectAll(supabase, 'football', 'teams', 'id,name,short_code,image_path'),
        selectAll(supabase, 'football', 'fixtures', 'id,starting_at',
            (q) => q.eq('season_id', seasonId))
    ]);
    const fixtureIds = fixtures.map((fixture) => fixture.id);
    const sportmonksIds = players.map((player) => player.sportmonks_player_id).filter(Boolean);
    const lineups = fixtureIds.length && sportmonksIds.length
        ? await selectAll(supabase, 'football', 'player_lineups',
            'sportmonks_player_id,team_id,fixture_id',
            (q) => q.in('fixture_id', fixtureIds).in('sportmonks_player_id', sportmonksIds))
        : [];

    const kickoffByFixture = new Map(fixtures.map((fixture) => [
        fixture.id,
        fixture.starting_at ? Date.parse(fixture.starting_at) : 0
    ]));
    const latestTeam = new Map();
    for (const lineup of lineups) {
        const kickoff = kickoffByFixture.get(lineup.fixture_id) || 0;
        const previous = latestTeam.get(lineup.sportmonks_player_id);
        if (lineup.team_id && (!previous || kickoff > previous.kickoff)) {
            latestTeam.set(lineup.sportmonks_player_id, { teamId: lineup.team_id, kickoff });
        }
    }
    const playerById = new Map(players.map((player) => [player.id, player]));
    const priceById = new Map(prices.map((price) => [price.player_id, Number(price.price)]));
    const teamById = new Map(teams.map((team) => [team.id, team]));

    return picks.map((pick) => {
        const player = playerById.get(pick.player_id);
        if (!player) return { ...pick, player: null };
        const clubId = latestTeam.get(player.sportmonks_player_id)?.teamId ?? null;
        const club = teamById.get(clubId);
        return {
            slot: pick.slot,
            isCaptain: pick.is_captain,
            isViceCaptain: pick.is_vice_captain,
            isBench: pick.is_bench,
            player: {
                id: player.id,
                name: player.display_name || player.common_name ||
                    [player.firstname, player.lastname].filter(Boolean).join(' ') || 'Unknown player',
                position: POSITION_BY_ID[player.position_id] || 'MID',
                team: club?.name ?? null,
                teamId: clubId,
                teamCrest: club?.image_path || null,
                imageUrl: player.image_path || null,
                nationalityId: player.nationality_id,
                price: priceById.get(player.id) ?? null
            }
        };
    });
};

const findMyTeam = async (supabase, userId, seasonId) => {
    const { data, error } = await supabase.schema('app').from('fantasy_teams')
        .select('*').eq('owner_auth_user_id', userId).eq('season_id', seasonId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return shapeTeam(data, await getPicks(supabase, data.id, seasonId));
};

const shapeTeam = (team, picks) => ({
    id: team.id,
    userId: team.owner_auth_user_id,
    seasonId: team.season_id,
    teamName: team.team_name,
    formation: team.formation,
    budgetRemaining: Number(team.budget_remaining),
    totalPoints: team.total_points,
    gameweekPoints: team.gameweek_points,
    activeChip: team.active_chip,
    usedChips: team.used_chips,
    updatedAt: team.updated_at,
    picks
});

const handleTeam = async (event, supabase, user, season) => {
    if (event.httpMethod === 'GET') {
        const team = await findMyTeam(supabase, user.id, season.id);
        return response(200, { team });
    }
    if (event.httpMethod !== 'PUT') return response(405, { error: 'Use GET or PUT for /team' });

    const body = parseBody(event);
    if (!body) return response(400, { error: 'Request body must be valid JSON' });
    if (typeof body.teamName !== 'string' || body.teamName.trim().length < 1 || body.teamName.trim().length > 40) {
        return response(400, { error: 'Team name must be between 1 and 40 characters' });
    }
    if (!FORMATIONS.has(body.formation)) return response(400, { error: 'Unsupported formation' });
    if (!Array.isArray(body.picks) || body.picks.length !== 15) {
        return response(400, { error: 'Submit exactly 15 player picks' });
    }
    for (const pick of body.picks) {
        if (!Number.isInteger(pick.playerId) || !Number.isInteger(pick.slot) ||
            typeof pick.isCaptain !== 'boolean' || typeof pick.isViceCaptain !== 'boolean' ||
            typeof pick.isBench !== 'boolean') {
            return response(400, { error: 'Each pick needs playerId, slot, captain, vice-captain, and bench values' });
        }
    }

    const { data: team, error } = await supabase.schema('app').rpc('save_fantasy_team', {
        p_user_id: user.id,
        p_season_id: season.id,
        p_team_name: body.teamName.trim(),
        p_formation: body.formation,
        p_picks: body.picks.map((pick) => ({
            playerId: pick.playerId,
            slot: pick.slot,
            isCaptain: pick.isCaptain,
            isViceCaptain: pick.isViceCaptain,
            isBench: pick.isBench
        }))
    });
    if (error) {
        const status = /not found|over the 300|maximum 3|formation|requires|needs|Choose|known PSL|bench|Starting lineup/i.test(error.message)
            ? 400 : 500;
        return response(status, { error: error.message });
    }
    return response(200, { team: shapeTeam(team, await getPicks(supabase, team.id, season.id)) });
};

const handleCreateLeague = async (event, supabase, user, season) => {
    if (event.httpMethod === 'GET') {
        const { data: memberships, error } = await supabase.schema('app')
            .from('fantasy_league_members').select('league_id')
            .eq('auth_user_id', user.id);
        if (error) throw error;
        const ids = memberships.map((row) => row.league_id);
        if (!ids.length) return response(200, { leagues: [] });
        const { data: leagues, error: leagueError } = await supabase.schema('app')
            .from('fantasy_leagues').select('id,name,join_code,season_id,owner_auth_user_id,created_at')
            .in('id', ids).eq('season_id', season.id).order('created_at');
        if (leagueError) throw leagueError;
        return response(200, { leagues: (leagues || []).map((league) => ({
            id: league.id,
            name: league.name,
            joinCode: league.owner_auth_user_id === user.id ? league.join_code : null,
            seasonId: league.season_id,
            isOwner: league.owner_auth_user_id === user.id,
            createdAt: league.created_at
        })) });
    }
    if (event.httpMethod !== 'POST') return response(405, { error: 'Use GET or POST for /leagues' });

    const body = parseBody(event);
    if (!body) return response(400, { error: 'Request body must be valid JSON' });
    if (typeof body.name !== 'string' || body.name.trim().length < 1 || body.name.trim().length > 50) {
        return response(400, { error: 'League name must be between 1 and 50 characters' });
    }
    const joinCode = randomBytes(5).toString('hex').slice(0, 8).toUpperCase();
    const { data: league, error } = await supabase.schema('app').rpc('create_fantasy_league', {
        p_user_id: user.id,
        p_season_id: season.id,
        p_name: body.name.trim(),
        p_join_code: joinCode
    });
    if (error) {
        const status = /create a fantasy team/i.test(error.message) ? 409 : 500;
        return response(status, { error: error.message });
    }
    return response(201, { league: {
        id: league.id,
        name: league.name,
        joinCode: league.join_code,
        seasonId: league.season_id,
        createdAt: league.created_at
    } });
};

const joinLeague = async (event, supabase, user) => {
    if (event.httpMethod !== 'POST') return response(405, { error: 'Use POST to join a league' });
    const body = parseBody(event);
    if (!body) return response(400, { error: 'Request body must be valid JSON' });
    if (typeof body.code !== 'string' || body.code.trim().length !== 8) {
        return response(400, { error: 'Enter the 8-character league code' });
    }
    const { data, error } = await supabase.schema('app').rpc('join_fantasy_league', {
        p_user_id: user.id,
        p_join_code: body.code.trim().toUpperCase()
    });
    if (error) {
        const status = /not found/i.test(error.message) ? 404
            : /already a member|full|create a fantasy team/i.test(error.message) ? 409 : 500;
        return response(status, { error: error.message });
    }
    return response(200, { membership: data });
};

const activateChip = async (event, supabase, user, season) => {
    if (event.httpMethod !== 'POST') return response(405, { error: 'Use POST to activate a chip' });
    const body = parseBody(event);
    if (!body) return response(400, { error: 'Request body must be valid JSON' });
    if (!['bench_boost', 'triple_captain', 'wildcard'].includes(body.chip)) {
        return response(400, { error: 'Choose Bench Boost, Triple Captain, or Wildcard' });
    }
    const { data, error } = await supabase.schema('app').rpc('activate_fantasy_chip', {
        p_user_id: user.id,
        p_season_id: season.id,
        p_chip: body.chip
    });
    if (error) {
        const status = /create a fantasy team|already active/i.test(error.message) ? 409 : 500;
        return response(status, { error: error.message });
    }
    return response(200, { team: {
        id: data.id,
        teamName: data.team_name,
        activeChip: data.active_chip,
        usedChips: data.used_chips,
        updatedAt: data.updated_at
    } });
};

const getLeague = async (supabase, user, leagueId, season) => {
    const { data: member, error: memberError } = await supabase.schema('app')
        .from('fantasy_league_members').select('league_id')
        .eq('league_id', leagueId).eq('auth_user_id', user.id).maybeSingle();
    if (memberError) throw memberError;
    if (!member) return response(403, { error: 'Join this league to view its teams and standings' });

    const { data: league, error } = await supabase.schema('app').from('fantasy_leagues')
        .select('id,name,season_id,created_at')
        .eq('id', leagueId).eq('season_id', season.id).maybeSingle();
    if (error) throw error;
    if (!league) return response(404, { error: 'League not found' });
    const { data: members, error: membersError } = await supabase.schema('app')
        .from('fantasy_league_members').select('auth_user_id,team_id,joined_at')
        .eq('league_id', leagueId);
    if (membersError) throw membersError;
    const teamIds = members.map((row) => row.team_id);
    const { data: teams, error: teamsError } = await supabase.schema('app')
        .from('fantasy_teams').select('id,owner_auth_user_id,team_name,formation,total_points,gameweek_points')
        .in('id', teamIds);
    if (teamsError) throw teamsError;
    return response(200, { league: { ...league, members: (teams || []).map((team) => ({
        teamId: team.id,
        teamName: team.team_name,
        formation: team.formation,
        totalPoints: team.total_points,
        gameweekPoints: team.gameweek_points
    })) } });
};

const getOtherTeam = async (supabase, ownerId, season) => {
    const { data: team, error } = await supabase.schema('app').from('fantasy_teams')
        .select('id,owner_auth_user_id,season_id,team_name,formation,budget_remaining,total_points,gameweek_points,active_chip,used_chips,updated_at')
        .eq('owner_auth_user_id', ownerId).eq('season_id', season.id).maybeSingle();
    if (error) throw error;
    if (!team) return response(404, { error: 'Fantasy team not found' });
    return response(200, { team: shapeTeam(team, await getPicks(supabase, team.id, season.id)) });
};

const getStandings = async (supabase, user, leagueId, season, week) => {
    const { data: member, error: memberError } = await supabase.schema('app')
        .from('fantasy_league_members').select('league_id')
        .eq('league_id', leagueId).eq('auth_user_id', user.id).maybeSingle();
    if (memberError) throw memberError;
    if (!member) return response(403, { error: 'Join this league to view standings' });

    const { data: league, error } = await supabase.schema('app').from('fantasy_leagues')
        .select('id,name').eq('id', leagueId).eq('season_id', season.id).maybeSingle();
    if (error) throw error;
    if (!league) return response(404, { error: 'League not found' });
    const { data: members, error: membersError } = await supabase.schema('app')
        .from('fantasy_league_members').select('team_id').eq('league_id', leagueId);
    if (membersError) throw membersError;
    const teamIds = members.map((row) => row.team_id);
    const [{ data: teams, error: teamError }, { data: scores, error: scoreError }] = await Promise.all([
        supabase.schema('app').from('fantasy_teams')
            .select('id,team_name,total_points,gameweek_points').in('id', teamIds),
        week === null
            ? Promise.resolve({ data: [], error: null })
            : supabase.schema('app').from('fantasy_gameweek_scores')
                .select('team_id,points,gameweek').eq('gameweek', week).in('team_id', teamIds)
    ]);
    if (teamError) throw teamError;
    if (scoreError) throw scoreError;
    const scoreByTeam = new Map((scores || []).map((score) => [score.team_id, score.points]));
    const standings = (teams || []).map((team) => ({
        teamId: team.id,
        teamName: team.team_name,
        totalPoints: team.total_points,
        gameweekPoints: week === null ? team.gameweek_points : scoreByTeam.get(team.id) || 0
    })).sort((a, b) => week === null
        ? b.totalPoints - a.totalPoints || a.teamName.localeCompare(b.teamName)
        : b.gameweekPoints - a.gameweekPoints || b.totalPoints - a.totalPoints || a.teamName.localeCompare(b.teamName)
    ).map((row, index) => ({ ...row, rank: index + 1 }));
    return response(200, { league, period: week === null ? 'overall' : 'weekly', gameweek: week, standings });
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return response(204, {});

    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const supabase = getSupabaseClient();
    if (!supabase || !serviceKey) {
        return response(500, { error: 'Fantasy API requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY' });
    }

    const authorization = event.headers?.authorization || event.headers?.Authorization || '';
    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return response(401, { error: 'Sign in is required' });
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) return response(401, { error: 'Your sign-in has expired; please sign in again' });
    const user = authData.user;

    try {
        const parsedUrl = new URL(event.rawUrl || `https://touchline.invalid${event.path || ''}`);
        const path = parsedUrl.pathname
            .replace(/^\/api\/v1\/fantasy/, '')
            .replace(/^\/\.netlify\/functions\/fantasy/, '') || '/';
        const season = await currentSeason(supabase);

        if (path === '/team') return await handleTeam(event, supabase, user, season);
        if (path === '/chip') return await activateChip(event, supabase, user, season);
        if (path === '/leagues') return await handleCreateLeague(event, supabase, user, season);
        if (path === '/leagues/join') return await joinLeague(event, supabase, user);

        const standingsMatch = path.match(/^\/leagues\/([0-9a-f-]+)\/standings$/i);
        if (standingsMatch && event.httpMethod === 'GET') {
            const rawWeek = parsedUrl.searchParams.get('gameweek');
            const week = rawWeek === null ? null : Number(rawWeek);
            if (week !== null && (!Number.isInteger(week) || week < 1)) {
                return response(400, { error: 'gameweek must be a positive whole number' });
            }
            return await getStandings(supabase, user, standingsMatch[1], season, week);
        }

        const leagueMatch = path.match(/^\/leagues\/([0-9a-f-]+)$/i);
        if (leagueMatch && event.httpMethod === 'GET') {
            return await getLeague(supabase, user, leagueMatch[1], season);
        }

        const teamMatch = path.match(/^\/teams\/([0-9a-f-]+)$/i);
        if (teamMatch && event.httpMethod === 'GET') {
            return await getOtherTeam(supabase, teamMatch[1], season);
        }

        return response(404, { error: 'Fantasy endpoint not found' });
    } catch (error) {
        console.error('fantasy API failed:', error);
        return response(error.statusCode || 500, { error: error.message || 'Fantasy request failed' });
    }
};
