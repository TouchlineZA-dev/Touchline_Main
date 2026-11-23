import { FantasySquadPick, PlayerScoreBreakdown, ScoringEvent, ChipType } from '@/types/fantasy';

/**
 * Calculate player score according to exact whiteboard rules:
 * - 1 pt: Half played (>= 45 mins)
 * - 1 pt: Full match played (>= 90 mins)
 * - 3 pts: Goal scored (each)
 * - 2 pts: Assisted goal (each)
 * - 2 pts: Clean sheet (GK / DEF)
 * - Captain: x3 multiplier; Triple Captain multiplies that captain score by 3 again
 * - Vice Captain: x2 multiplier
 */
export const calculatePlayerScore = (
    event: ScoringEvent,
    isGkOrDef: boolean,
    isCaptain: boolean,
    isViceCaptain: boolean,
    activeChip: ChipType | null
): PlayerScoreBreakdown => {
    // Appearance points
    const halfPlayedPoints = event.minutesPlayed >= 45 ? 1 : 0;
    const fullMatchPoints = event.minutesPlayed >= 90 ? 1 : 0;

    // Attacking & Defending
    const goalPoints = (event.goals || 0) * 3;
    const assistPoints = (event.assists || 0) * 2;
    const cleanSheetPoints = isGkOrDef && event.cleanSheet ? 2 : 0;

    const basePoints =
        halfPlayedPoints +
        fullMatchPoints +
        goalPoints +
        assistPoints +
        cleanSheetPoints;

    // Multiplier calculation
    let multiplier = 1;
    if (isCaptain) {
        multiplier = activeChip === 'triple_captain' ? 9 : 3;
    } else if (isViceCaptain) {
        multiplier = 2; // Whiteboard rule: "x2 - VC"
    }

    const finalPoints = basePoints * multiplier;

    return {
        halfPlayedPoints,
        fullMatchPoints,
        goalPoints,
        assistPoints,
        cleanSheetPoints,
        basePoints,
        multiplier,
        finalPoints
    };
};

/**
 * Calculates total gameweek squad score taking Bench Boost into account.
 */
export const calculateSquadTotal = (
    picks: FantasySquadPick[],
    scoringMap: Record<number, ScoringEvent>,
    activeChip: ChipType | null
): { totalPoints: number; playerScores: Record<number, PlayerScoreBreakdown> } => {
    let totalPoints = 0;
    const playerScores: Record<number, PlayerScoreBreakdown> = {};

    for (const pick of picks) {
        const event = scoringMap[pick.player.id] || {
            minutesPlayed: 0,
            goals: 0,
            assists: 0,
            cleanSheet: false,
        };

        const isGkOrDef = pick.player.position === 'GK' || pick.player.position === 'DEF';
        const breakdown = calculatePlayerScore(
            event,
            isGkOrDef,
            pick.isCaptain,
            pick.isViceCaptain,
            activeChip
        );

        playerScores[pick.player.id] = breakdown;

        // If bench boost is active, bench points count towards total
        if (!pick.isBench || activeChip === 'bench_boost') {
            totalPoints += breakdown.finalPoints;
        }
    }

    return { totalPoints, playerScores };
};
