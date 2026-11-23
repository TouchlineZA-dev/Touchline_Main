/**
 * Client for the Touchline data API.
 *
 * Everything here reads the live football data the sync worker maintains.
 * The browser never talks to Postgres directly — these all go through the
 * Netlify functions in `netlify/functions/`.
 */

const isNative = typeof window !== 'undefined' &&
    window.location?.protocol === 'https:' &&
    window.location?.hostname === 'localhost';

const API_BASE_URL = isNative
    ? 'https://backendfpsl.netlify.app/api/v1'
    : (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');

export type Position = 'GK' | 'DEF' | 'MID' | 'ATT';

export interface ApiPlayer {
    /** Internal football.players.id — the id every app table references. */
    id: number;
    sportmonksPlayerId: number;
    name: string;
    position: Position;
    /** Inferred from the player's most recent lineup; null if they haven't played. */
    team: string | null;
    teamId: number | null;
    teamCrest: string | null;
    nationalityId: number | null;
    /** null when Sportmonks only has a placeholder — render your own fallback. */
    imageUrl: string | null;
    /** On the 300.0 budget scale (app.player_prices.price). */
    price: number;
    rating: number;
    pace: number;
    shooting: number;
    passing: number;
    defending: number;
    dribbling: number;
    physical: number;
}

export type FixtureStatus =
    | 'Scheduled'
    | 'Live'
    | 'Finished'
    | 'Postponed'
    | 'Cancelled'
    | 'Abandoned'
    | 'No result';

export interface ApiFixture {
    id: number;
    sportmonksFixtureId: number;
    homeTeam: string;
    awayTeam: string;
    homeTeamId: number | null;
    awayTeamId: number | null;
    homeCrest: string | null;
    awayCrest: string | null;
    homeScore: number | null;
    awayScore: number | null;
    /** UTC ISO timestamp. */
    kickoff: string | null;
    stateId: number | null;
    status: FixtureStatus;
    scorers?: ApiFixtureScorer[];
}

export interface ApiFixtureScorer {
    minute: number | null;
    extraMinute: number | null;
    player: string | null;
    teamId: number | null;
    side: 'home' | 'away' | null;
    type: 'Goal' | 'Own goal' | 'Penalty scored';
}

export interface ApiStanding {
    position: number;
    teamId: number;
    team: string;
    shortCode: string | null;
    crest: string | null;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    points: number;
    /** Last five results, oldest first. */
    form: ('W' | 'D' | 'L')[];
}

export interface ApiCompetitionRef {
    id: number;
    sportmonksCompetitionId: number;
    name: string;
    shortCode: string | null;
    active?: boolean;
}

export interface ApiSeasonRef {
    id: number;
    sportmonksSeasonId: number;
    name: string;
    isCurrent: boolean;
    finished?: boolean;
    pending?: boolean;
}

export interface ApiPlayerRankingRow {
    rank: number;
    playerId: number;
    sportmonksPlayerId: number;
    player: string;
    jerseyNumber: number | null;
    club: string | null;
    clubId: number | null;
    total: number;
}

export interface ApiPlayerRankingsResponse {
    competition: ApiCompetitionRef;
    competitions: ApiCompetitionRef[];
    season: ApiSeasonRef;
    seasons: ApiSeasonRef[];
    matchesCounted: number;
    rankings: {
        goals: ApiPlayerRankingRow[];
        assists: ApiPlayerRankingRow[];
        cleanSheets: ApiPlayerRankingRow[];
    };
}

export interface ApiTeamRef {
    id: number;
    name: string;
    shortCode: string | null;
    crest: string | null;
}

export interface ApiMatchEvent {
    id: number;
    typeId: number;
    type: string;
    minute: number | null;
    extraMinute: number | null;
    team: ApiTeamRef | null;
    side: 'home' | 'away' | null;
    player: string | null;
    /** Second player: substitution partner, or possible assist (unreliable). */
    relatedPlayer: string | null;
    /** Sportmonks ids, for pinning events to lineup entries. */
    sportmonksPlayerId: number | null;
    relatedSportmonksPlayerId: number | null;
    result: string | null;
}

export interface ApiLineupPlayer {
    id: number;
    player: string | null;
    sportmonksPlayerId: number;
    jerseyNumber: number | null;
    position: Position | null;
    positionId: number | null;
    photo: string | null;
}

export interface ApiTeamStat {
    typeId: number;
    label: string;
    home: number | null;
    away: number | null;
}

export interface ApiMatchDetail {
    fixture: {
        id: number;
        sportmonksFixtureId: number;
        homeTeam: ApiTeamRef | null;
        awayTeam: ApiTeamRef | null;
        homeScore: number | null;
        awayScore: number | null;
        homePenaltyScore: number | null;
        awayPenaltyScore: number | null;
        kickoff: string | null;
        stateId: number | null;
        status: FixtureStatus;
        resultInfo: string | null;
    };
    events: ApiMatchEvent[];
    lineups: {
        home: { starting: ApiLineupPlayer[]; bench: ApiLineupPlayer[] };
        away: { starting: ApiLineupPlayer[]; bench: ApiLineupPlayer[] };
    };
    statistics: ApiTeamStat[];
    /** Provider stat codes we have no name for; withheld from `statistics`. */
    unlabelledStatTypes?: number[];
    /** Always true on this data plan — never present these as per-player. */
    statisticsAreTeamLevel: boolean;
}

interface SeasonRef {
    id: number;
    name: string;
}

const get = async <T>(path: string): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${path}`);

    if (!response.ok) {
        let detail = `${response.status} ${response.statusText}`;
        try {
            const body = await response.json();
            if (body?.error) detail = body.error;
        } catch {
            // response wasn't JSON — keep the status line
        }
        throw new Error(detail);
    }

    return response.json() as Promise<T>;
};

export const fetchPlayers = () =>
    get<{ season: SeasonRef; count: number; players: ApiPlayer[] }>('/players');

export const fetchFixtures = (range?: { from?: string; to?: string }) => {
    const params = new URLSearchParams();
    if (range?.from) params.set('from', range.from);
    if (range?.to) params.set('to', range.to);

    const query = params.toString();
    return get<{ season: SeasonRef; count: number; fixtures: ApiFixture[] }>(
        `/fixtures${query ? `?${query}` : ''}`
    );
};

export const fetchStandings = () =>
    get<{
        season: SeasonRef;
        count: number;
        matchesCounted: number;
        computedFrom: string;
        standings: ApiStanding[];
    }>('/standings');

export const fetchPlayerRankings = (params?: { competitionId?: number; seasonId?: number }) => {
    const query = new URLSearchParams();
    if (params?.competitionId) query.set('competitionId', String(params.competitionId));
    if (params?.seasonId) query.set('seasonId', String(params.seasonId));

    const suffix = query.toString();
    return get<ApiPlayerRankingsResponse>(`/player-rankings${suffix ? `?${suffix}` : ''}`);
};

export const fetchMatchDetail = (fixtureId: number) =>
    get<ApiMatchDetail>(`/matches?fixtureId=${fixtureId}`);

export interface ApiArticle {
    title: string;
    url: string;
    imageUrl: string | null;
    publishedAt: string | null;
    summary: string;
    /** Publication name, e.g. "SoccerLaduma". */
    source: string;
    tag?: string;
}

export interface ApiNewsResponse {
    totalArticles: number;
    articles: ApiArticle[];
    /** When the sync worker last refreshed the cache. */
    fetchedAt?: string | null;
    /** Set when the cache could not be read — the UI shows an empty state. */
    unavailable?: boolean;
    detail?: string;
}

export const fetchNews = (max = 20) => get<ApiNewsResponse>(`/news/headlines?max=${max}`);

/** Fixture states that mean the result is final — BACKEND_INTEGRATION.md §6. */
export const FINAL_STATE_IDS = [5, 7, 8];

export const isFinished = (fixture: Pick<ApiFixture, 'stateId'>) =>
    fixture.stateId !== null && FINAL_STATE_IDS.includes(fixture.stateId);

export const LIVE_STATE_IDS = [2, 3, 4, 6, 9, 21, 22];

export const isLive = (
    fixture: Pick<ApiFixture, 'stateId'> & { status?: string; kickoff?: string | null }
) => {
    if (fixture.status === 'Live') return true;
    if (fixture.stateId !== null && LIVE_STATE_IDS.includes(fixture.stateId)) return true;
    if (fixture.kickoff && !isFinished(fixture) && !hasNoResult(fixture)) {
        const start = Date.parse(fixture.kickoff);
        const now = Date.now();
        if (!isNaN(start) && now >= start && now - start < 125 * 60 * 1000) {
            return true;
        }
    }
    return false;
};

/** Postponed / cancelled / abandoned — shown, but never counted as a result. */
export const hasNoResult = (fixture: Pick<ApiFixture, 'stateId'>) =>
    fixture.stateId !== null && [10, 12, 15].includes(fixture.stateId);

/** Sportmonks serves placeholders for roughly half the player photos. */
export const playerImage = (player: Pick<ApiPlayer, 'imageUrl'>, fallback = '/placeholder.svg') =>
    player.imageUrl ?? fallback;

const SAST = 'Africa/Johannesburg';

/** Render a UTC kickoff in South African time. */
export const toSast = (utcIso: string | null) =>
    utcIso ? new Date(utcIso).toLocaleString('en-ZA', { timeZone: SAST }) : 'TBD';

/** "19:30" in SAST. */
export const sastTime = (utcIso: string | null) =>
    utcIso
        ? new Date(utcIso).toLocaleTimeString('en-ZA', {
              timeZone: SAST,
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
          })
        : 'TBD';

/** "Sat, 19 Jan" in SAST. */
export const sastDate = (utcIso: string | null) =>
    utcIso
        ? new Date(utcIso).toLocaleDateString('en-ZA', {
              timeZone: SAST,
              weekday: 'short',
              day: 'numeric',
              month: 'short'
          })
        : 'Date TBD';

/** Group key ("2026-01-19") for bucketing fixtures by SAST match day. */
export const sastDayKey = (utcIso: string | null) =>
    utcIso ? new Date(utcIso).toLocaleDateString('en-CA', { timeZone: SAST }) : 'unknown';
