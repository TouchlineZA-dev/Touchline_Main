import { ApiFixture, ApiTeam, StandingEntry } from './api/types';

export type TeamLookup = Map<number, ApiTeam>;

export const buildTeamLookup = (teams: ApiTeam[]): TeamLookup => new Map(teams.map((t) => [t.id, t]));

/**
 * Builds a league table from the season's finished fixtures (3 pts win, 1 draw).
 * Sorted by points, goal difference, goals scored, then name.
 */
export function computeStandings(fixtures: ApiFixture[], teams: TeamLookup): StandingEntry[] {
  const rows = new Map<string, StandingEntry>();

  const row = (teamId: number | null, name: string): StandingEntry => {
    const key = teamId != null ? `id:${teamId}` : `name:${name}`;
    let entry = rows.get(key);
    if (!entry) {
      entry = {
        position: 0,
        teamId,
        team: name,
        crestUrl: teamId != null ? teams.get(teamId)?.crestUrl ?? null : null,
        played: 0, won: 0, drawn: 0, lost: 0,
        goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
      };
      rows.set(key, entry);
    }
    return entry;
  };

  for (const f of fixtures) {
    // Every club in the season appears in the table, even before playing.
    const home = row(f.homeTeamId, f.homeTeam);
    const away = row(f.awayTeamId, f.awayTeam);
    if (f.status !== 'Finished' || f.homeScore == null || f.awayScore == null) continue;

    home.played++; away.played++;
    home.goalsFor += f.homeScore; home.goalsAgainst += f.awayScore;
    away.goalsFor += f.awayScore; away.goalsAgainst += f.homeScore;

    if (f.homeScore > f.awayScore) { home.won++; away.lost++; home.points += 3; }
    else if (f.homeScore < f.awayScore) { away.won++; home.lost++; away.points += 3; }
    else { home.drawn++; away.drawn++; home.points++; away.points++; }
  }

  return [...rows.values()]
    .map((r) => ({ ...r, goalDifference: r.goalsFor - r.goalsAgainst }))
    .sort((a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      a.team.localeCompare(b.team))
    .map((r, i) => ({ ...r, position: i + 1 }));
}

const TZ = 'Africa/Johannesburg';

export const formatDayHeader = (iso: string) =>
  new Date(iso).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ });

export const formatKickoffTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-ZA', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ,
  });

/** Local calendar-day key used for grouping fixtures by date. */
export const dayKey = (iso: string) =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
