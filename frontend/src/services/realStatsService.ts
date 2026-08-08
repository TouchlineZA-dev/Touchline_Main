
import { MatchStats } from './pointsService';

// Interface for what we return to the app
export interface RealPlayerPerformance {
    playerId: string;
    name: string;
    team: string;
    stats: MatchStats;
    points: number;
    fixtureId: number;
}

// 1. Fetch Fixtures for a specific Gameweek (or date range)
export const fetchFixturesForGameweek = async (fromDate: string, toDate: string) => {
    console.log(`[RealStats] Runtime provider calls are disabled. Read fixtures for ${fromDate} to ${toDate} from Supabase/backend instead.`);
    return [];
};

// 2. Fetch Detailed Stats for a specific Fixture
// This is the "Repurposed" part: leveraging the API's deep stats capability
export const fetchFixturePlayerStats = async (fixtureId: number, homeTeamId: number, awayTeamId: number, goalsHome: number, goalsAway: number): Promise<RealPlayerPerformance[]> => {
    console.log(`[RealStats] Runtime provider calls are disabled for fixture ${fixtureId}. Use stored player match stats from Supabase/backend.`);
    void homeTeamId;
    void awayTeamId;
    void goalsHome;
    void goalsAway;
    return [];
};

// 3. MASTER FUNCTION: Get All Player Scores for a Date Range
export const getRealGameweekScores = async (fromDate: string, toDate: string) => {
    const fixtures = await fetchFixturesForGameweek(fromDate, toDate);
    console.log(`[RealStats] Found ${fixtures.length} matches. Processing stats...`);

    let allPlayerScores: RealPlayerPerformance[] = [];

    for (const fixture of fixtures) {
        // Only process finished games
        if (['FT', 'AET', 'PEN'].includes(fixture.fixture.status.short)) {
            const stats = await fetchFixturePlayerStats(
                fixture.fixture.id,
                fixture.teams.home.id,
                fixture.teams.away.id,
                fixture.goals.home ?? 0,
                fixture.goals.away ?? 0
            );
            allPlayerScores = [...allPlayerScores, ...stats];
            // Rate limit safety
            await new Promise(r => setTimeout(r, 200));
        }
    }

    console.log(`[RealStats] Calculated scores for ${allPlayerScores.length} players.`);
    return allPlayerScores;
};
