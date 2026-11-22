import { ApiPlayer } from '@/services/touchlineApi';

export type Formation = '4-4-2' | '4-3-3' | '3-5-2' | '3-4-3' | '5-3-2';

export interface FormationLayout {
    def: number;
    mid: number;
    att: number;
}

export const FORMATIONS: Record<Formation, FormationLayout> = {
    '4-4-2': { def: 4, mid: 4, att: 2 },
    '4-3-3': { def: 4, mid: 3, att: 3 },
    '3-5-2': { def: 3, mid: 5, att: 2 },
    '3-4-3': { def: 3, mid: 4, att: 3 },
    '5-3-2': { def: 5, mid: 3, att: 2 }
};

export type ChipType = 'bench_boost' | 'triple_captain' | 'wildcard';

export interface FantasySquadPick {
    player: ApiPlayer;
    isCaptain: boolean;
    isViceCaptain: boolean;
    isBench: boolean;
    slot: number; // 0..10 for starting XI, 11..14 for bench (11=GK sub, 12=DEF sub, 13=MID sub, 14=ATT sub)
}

export interface FantasySquad {
    id: string;
    userId: string;
    teamName: string;
    formation: Formation;
    picks: FantasySquadPick[];
    budgetRemaining: number;
    activeChip: ChipType | null;
    usedChips: ChipType[];
    gameweek: number;
    gameweekPoints: number;
    totalPoints: number;
    updatedAt: string;
}

export interface ScoringEvent {
    minutesPlayed: number;
    goals: number;
    assists: number;
    cleanSheet: boolean;
}

export interface PlayerScoreBreakdown {
    halfPlayedPoints: number;    // +1 if >= 45m
    fullMatchPoints: number;     // +1 if >= 90m
    goalPoints: number;          // +3 per goal
    assistPoints: number;        // +2 per assist
    cleanSheetPoints: number;    // +2 for clean sheet (GK/DEF)
    basePoints: number;
    multiplier: number;          // 1, 2 (VC), 3 (Captain), or 9 (Triple Captain)
    finalPoints: number;
}

export interface MiniLeagueMember {
    userId: string;
    username: string;
    teamName: string;
    clubCrest?: string;
    totalPoints: number;
    gameweekPoints: number;
    rank: number;
}

export interface MiniLeague {
    id: string;
    name: string;
    code: string;
    ownerId: string;
    maxMembers: 20;
    members: MiniLeagueMember[];
    createdAt: string;
}
