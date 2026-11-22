export interface ApiPlayer {
  id: number;
  sportmonksPlayerId?: number;
  name: string;
  position: 'GK' | 'DEF' | 'MID' | 'ATT';
  team: string | null;
  teamId?: number | null;
  teamCrest?: string | null;
  price: number;
  rating?: number;
}

export interface ApiFixture {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeCrest?: string | null;
  awayCrest?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  kickoff?: string | null;
  status: string;
  stateId?: number | null;
}

export interface ApiStanding {
  position: number;
  team: string;
  crest?: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface ApiArticle {
  title: string;
  url: string;
  imageUrl?: string | null;
  publishedAt?: string | null;
  summary?: string;
  source?: string;
  tag?: string;
}

export interface FantasyPick {
  playerId: number;
  slot: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
  isBench: boolean;
  player?: ApiPlayer | null;
}

export interface FantasyTeam {
  teamName: string;
  formation: string;
  budgetRemaining: number;
  picks: FantasyPick[];
  activeChip?: string | null;
  usedChips?: string[];
  totalPoints?: number;
  gameweekPoints?: number;
}

export interface SaveTeamPayload {
  teamName: string;
  formation: string;
  picks: {
    playerId: number;
    slot: number;
    isCaptain: boolean;
    isViceCaptain: boolean;
    isBench: boolean;
  }[];
}

export interface FantasyLeague {
  id: string;
  name: string;
  code?: string;
  isOwner?: boolean;
}

export interface LeagueStanding {
  rank: number;
  teamName: string;
  totalPoints: number;
  gameweekPoints: number;
}
