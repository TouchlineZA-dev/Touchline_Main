import { FantasySquad, MiniLeague, MiniLeagueMember, ChipType } from '@/types/fantasy';

export const MINI_LEAGUE_CAPACITY = 20 as const;

export type RuleResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Only one chip can be active for a gameweek. */
export const activateChip = (squad: FantasySquad, chip: ChipType): RuleResult<FantasySquad> => {
    if (squad.activeChip) return { ok: false, error: 'A chip is already active for this gameweek.' };

    return {
        ok: true,
        value: {
            ...squad,
            activeChip: chip,
            usedChips: squad.usedChips.includes(chip) ? squad.usedChips : [...squad.usedChips, chip],
            updatedAt: new Date().toISOString()
        }
    };
};

export const clearActiveChipForNextGameweek = (squad: FantasySquad): FantasySquad => ({
    ...squad,
    activeChip: null,
    gameweek: squad.gameweek + 1,
    gameweekPoints: 0,
    updatedAt: new Date().toISOString()
});

/** Wildcard removes the free-transfer limit for the current gameweek. */
export const getTransferLimit = (freeTransfers: number, activeChip: ChipType | null) =>
    activeChip === 'wildcard' ? Number.POSITIVE_INFINITY : Math.max(0, freeTransfers);

export const canJoinMiniLeague = (league: MiniLeague, userId: string): RuleResult<MiniLeague> => {
    if (league.members.some((member) => member.userId === userId)) {
        return { ok: false, error: 'You are already a member of this league.' };
    }
    if (league.members.length >= MINI_LEAGUE_CAPACITY) {
        return { ok: false, error: 'This mini-league is full (maximum 20 members).' };
    }
    return { ok: true, value: league };
};

/** Ranks a mini-league by the selected week, resolving ties by overall points. */
export const rankMiniLeagueMembers = (
    members: MiniLeagueMember[],
    period: 'weekly' | 'overall' = 'weekly'
): MiniLeagueMember[] =>
    [...members]
        .sort((a, b) =>
            period === 'weekly'
                ? b.gameweekPoints - a.gameweekPoints || b.totalPoints - a.totalPoints || a.username.localeCompare(b.username)
                : b.totalPoints - a.totalPoints || a.username.localeCompare(b.username)
        )
        .map((member, index) => ({ ...member, rank: index + 1 }));
