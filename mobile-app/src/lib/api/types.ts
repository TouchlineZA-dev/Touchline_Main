// Response shapes from the Touchline API (http://localhost:5147/openapi/v1.json).
// Enums are serialised as strings. Money is in millions (7.5 = R7.5m).

export type Position = 'Unknown' | 'GK' | 'DEF' | 'MID' | 'ATT';
export type MatchStatus = 'Scheduled' | 'Live' | 'Finished' | 'NoResult';

export interface SeasonRef {
  id: number;
  name: string;
}

export interface Season extends SeasonRef {
  competitionId: number;
  startingAt: string | null;
  endingAt: string | null;
}

export interface ApiTeam {
  id: number;
  name: string;
  shortCode: string | null;
  crestUrl: string | null;
}

export interface ApiPlayer {
  id: number;
  sportmonksPlayerId: number;
  name: string;
  position: Position;
  teamId: number | null;
  team: string | null;
  teamCrest: string | null;
  nationalityId: number | null;
  imageUrl: string | null;
  price: number;
}

export interface ApiFixture {
  id: number;
  sportmonksFixtureId: number;
  kickoffUtc: string | null;
  status: MatchStatus;
  stateId: number | null;
  homeTeamId: number | null;
  homeTeam: string;
  awayTeamId: number | null;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
}

export interface Gameweek {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  seasonId: number | null;
  readyToScore: boolean;
}

export interface Me {
  id: number;
  username: string | null;
  email: string;
  authUserId: string;
}

// ---- Fantasy ---------------------------------------------------------------------------------

export interface GameweekRef {
  id: number;
  number: number;
  name: string;
  startDate: string;
  endDate: string;
  deadline: string | null;
  locked: boolean;
}

export interface FantasyTeam {
  id: number;
  name: string;
  seasonId: number;
  budgetRemaining: number;
  squadValue: number | null;
  nextGameweek: GameweekRef | null;
}

export interface SquadPlayer {
  playerId: number;
  name: string;
  position: Position;
  clubId: number | null;
  club: string | null;
  price: number;
  purchasePrice: number | null;
  isStarter: boolean;
  benchOrder: number | null;
  isCaptain: boolean;
  isViceCaptain: boolean;
  noClubYet: boolean;
}

export interface Squad {
  teamId: number;
  gameweek: GameweekRef;
  formation: string | null;
  captainId: number | null;
  viceCaptainId: number | null;
  chip: string | null;
  transfersMade: number;
  transferCost: number;
  freeTransfersLeft: number | null;
  budgetRemaining: number;
  squadValue: number;
  version: number;
  saved: boolean;
  players: SquadPlayer[];
  warnings: string[];
}

export interface TeamPoints {
  teamId: number;
  gameweek: GameweekRef;
  provisional: boolean;
  chip: string | null;
  total: number;
  pointsBeforeHits: number;
  transferCost: number;
  benchPoints: number;
}

export interface LeagueSummary {
  id: string;
  name: string;
  isOverall: boolean;
  isOwner: boolean;
  joinCode: string | null;
  members: number;
  myRank: number | null;
  provisional: boolean;
}

export interface StandingRow {
  rank: number;
  fantasyTeamId: number;
  teamName: string;
  username: string;
  points: number;
  overallPoints: number;
  provisional: boolean;
}

export interface LeagueStandings {
  leagueId: string;
  name: string;
  gameweek: number | null;
  provisional: boolean;
  rows: StandingRow[];
}

export interface Snapshot {
  team: FantasyTeam;
  squad: Squad | null;
  chipsUsed: string[];
  freeTransfersLeft: number | null;
  deadline: string | null;
  latestPoints: TeamPoints | null;
  leagues: LeagueSummary[];
  generatedAtUtc: string;
}

export interface SquadRequest {
  formation: string;
  starters: number[];
  bench: number[];
  captainId: number | null;
  viceCaptainId: number | null;
  gameweek?: number | null;
}

// ---- News service (touchline-news-api) -------------------------------------------------------

export interface ApiArticle {
  id: string;
  title: string;
  summary: string | null;
  source: string;
  publishedAt: string;
  url: string;
  imageUrl: string | null;
  category: string;
  teams: string[];
}

export interface NewsCategory {
  id: string | number;
  name: string;
  slug: string;
}

// ---- Derived (computed in the app from API data) ---------------------------------------------

export interface StandingEntry {
  position: number;
  teamId: number | null;
  team: string;
  crestUrl: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}
