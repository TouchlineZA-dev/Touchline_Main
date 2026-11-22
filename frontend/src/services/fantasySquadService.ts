import { ApiPlayer } from '@/services/touchlineApi';
import { FantasySquad, FantasySquadPick, Formation, ChipType, FORMATIONS } from '@/types/fantasy';

const SQUAD_STORAGE_KEY = 'touchline_fantasy_squad_';

export const INITIAL_BUDGET = 300.0;
export const MAX_PLAYERS_PER_CLUB = 3;
export const ROSTER_REQUIREMENTS = { GK: 2, DEF: 5, MID: 5, ATT: 3 } as const;
export const BENCH_REQUIREMENTS = { GK: 1, DEF: 1, MID: 1, ATT: 1 } as const;

const clubKey = (player: ApiPlayer) =>
    player.teamId !== null ? `id:${player.teamId}` : player.team?.trim().toLocaleLowerCase() || null;

export const getStoredSquad = (userId: string): FantasySquad | null => {
    try {
        const raw = localStorage.getItem(`${SQUAD_STORAGE_KEY}${userId}`);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

export const saveStoredSquad = (squad: FantasySquad) => {
    try {
        localStorage.setItem(`${SQUAD_STORAGE_KEY}${squad.userId}`, JSON.stringify(squad));
    } catch (err) {
        console.error('Failed to save fantasy squad', err);
    }
};

export const createDefaultSquad = (
    userId: string,
    teamName: string,
    availablePlayers: ApiPlayer[]
): FantasySquad => {
    const formation: Formation = '4-4-2';
    const picks: FantasySquadPick[] = [];
    const clubCounts = new Map<string, number>();
    let totalCost = 0;
    const usedIds = new Set<number>();

    const choose = (position: ApiPlayer['position'], count: number, isBench: boolean) => {
        for (let n = 0; n < count; n++) {
            const candidate = availablePlayers
                .filter((player) => player.position === position && !usedIds.has(player.id))
                .filter((player) => clubKey(player) !== null)
                .filter((player) => (clubCounts.get(clubKey(player)!) ?? 0) < MAX_PLAYERS_PER_CLUB)
                .filter((player) => Number.isFinite(player.price) && player.price >= 0)
                .sort((a, b) => a.price - b.price || a.id - b.id)
                .find((player) => totalCost + player.price <= INITIAL_BUDGET + Number.EPSILON);

            if (!candidate) {
                throw new Error(`Unable to create a valid squad within budget: not enough eligible ${position} players.`);
            }

            const slot = picks.length;
            usedIds.add(candidate.id);
            const club = clubKey(candidate)!;
            clubCounts.set(club, (clubCounts.get(club) ?? 0) + 1);
            totalCost += candidate.price;
            picks.push({
                player: candidate,
                isCaptain: false,
                isViceCaptain: false,
                isBench,
                slot
            });
        }
    };

    choose('GK', 1, false);
    choose('DEF', FORMATIONS[formation].def, false);
    choose('MID', FORMATIONS[formation].mid, false);
    choose('ATT', FORMATIONS[formation].att, false);
    choose('GK', 1, true);
    choose('DEF', 1, true);
    choose('MID', 1, true);
    choose('ATT', 1, true);

    picks[1].isCaptain = true;
    picks[2].isViceCaptain = true;

    return {
        id: `squad_${userId}`,
        userId,
        teamName,
        formation,
        picks,
        budgetRemaining: Number((INITIAL_BUDGET - totalCost).toFixed(1)),
        activeChip: null,
        usedChips: [],
        gameweek: 1,
        gameweekPoints: 0,
        totalPoints: 0,
        updatedAt: new Date().toISOString()
    };
};

export const validateSquadRules = (picks: FantasySquadPick[], selectedFormation?: Formation): { valid: boolean; error?: string } => {
    if (picks.length !== 15) {
        return { valid: false, error: 'A complete squad requires exactly 15 players (11 Starting + 4 Bench).' };
    }

    // Check unique players
    const uniqueIds = new Set(picks.map((p) => p.player.id));
    if (uniqueIds.size !== 15) {
        return { valid: false, error: 'Duplicate players detected in squad.' };
    }

    const rosterCounts = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
    const starterCounts = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
    const benchCounts = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
    const slots = new Set<number>();
    let totalCost = 0;

    for (const pick of picks) {
        const position = pick.player.position;
        const expectedBench = pick.slot >= 11;
        if (pick.isBench !== expectedBench) {
            return { valid: false, error: 'Slots 0–10 are for starters and slots 11–14 are for the bench.' };
        }
        rosterCounts[position] += 1;
        if (pick.isBench) benchCounts[position] += 1;
        else starterCounts[position] += 1;

        if (!Number.isInteger(pick.slot) || pick.slot < 0 || pick.slot > 14 || slots.has(pick.slot)) {
            return { valid: false, error: 'Squad slots must be unique numbers from 0 to 14.' };
        }
        slots.add(pick.slot);

        const price = Number(pick.player.price);
        if (!Number.isFinite(price) || price < 0) {
            return { valid: false, error: `Invalid price for ${pick.player.name}.` };
        }
        totalCost += price;
    }

    for (const position of Object.keys(ROSTER_REQUIREMENTS) as Array<keyof typeof ROSTER_REQUIREMENTS>) {
        if (rosterCounts[position] !== ROSTER_REQUIREMENTS[position]) {
            return { valid: false, error: `Squad must contain ${ROSTER_REQUIREMENTS[position]} ${position} players.` };
        }
        if (benchCounts[position] !== BENCH_REQUIREMENTS[position]) {
            return { valid: false, error: 'Bench must contain exactly 1 goalkeeper, 1 defender, 1 midfielder, and 1 attacker.' };
        }
    }

    if (starterCounts.GK !== 1 || starterCounts.DEF < 3 || starterCounts.DEF > 5 ||
        starterCounts.MID < 3 || starterCounts.MID > 5 || starterCounts.ATT < 2 || starterCounts.ATT > 3 ||
        starterCounts.DEF + starterCounts.MID + starterCounts.ATT !== 10) {
        return { valid: false, error: 'Starting XI must have 1 GK and a supported formation: 4-4-2, 4-3-3, 3-5-2, 3-4-3, or 5-3-2.' };
    }

    const formationMatches = Object.values(FORMATIONS).some((formation) =>
        formation.def === starterCounts.DEF &&
        formation.mid === starterCounts.MID &&
        formation.att === starterCounts.ATT
    );
    if (!formationMatches) {
        return { valid: false, error: 'Starting XI does not match a supported formation.' };
    }
    if (selectedFormation && (
        starterCounts.DEF !== FORMATIONS[selectedFormation].def ||
        starterCounts.MID !== FORMATIONS[selectedFormation].mid ||
        starterCounts.ATT !== FORMATIONS[selectedFormation].att
    )) {
        return { valid: false, error: `Starting XI does not match the selected ${selectedFormation} formation.` };
    }

    if (totalCost > INITIAL_BUDGET + Number.EPSILON) {
        return { valid: false, error: `Squad cost exceeds the ${INITIAL_BUDGET.toFixed(1)} budget.` };
    }

    // Check club limit
    const clubCounts: Record<string, { name: string; count: number }> = {};
    for (const pick of picks) {
        const key = clubKey(pick.player);
        if (key === null) {
            return { valid: false, error: `${pick.player.name} has no club assigned.` };
        }
        const club = pick.player.team?.trim() || `Club ${pick.player.teamId}`;
        const current = clubCounts[key] || { name: club, count: 0 };
        current.count += 1;
        clubCounts[key] = current;
        if (current.count > MAX_PLAYERS_PER_CLUB) {
            return { valid: false, error: `Maximum ${MAX_PLAYERS_PER_CLUB} players allowed from ${club}.` };
        }
    }

    // Captain checks
    const captains = picks.filter((p) => p.isCaptain);
    const viceCaptains = picks.filter((p) => p.isViceCaptain);

    if (captains.length !== 1) {
        return { valid: false, error: 'Please designate exactly one Captain (C).' };
    }
    if (viceCaptains.length !== 1) {
        return { valid: false, error: 'Please designate exactly one Vice-Captain (VC).' };
    }
    if (captains[0].player.id === viceCaptains[0].player.id) {
        return { valid: false, error: 'Captain and Vice-Captain cannot be the same player.' };
    }
    if (captains[0].isBench || viceCaptains[0].isBench) {
        return { valid: false, error: 'Captain and Vice-Captain must be in the Starting XI.' };
    }

    return { valid: true };
};

export const validateFantasySquad = (squad: FantasySquad) =>
    validateSquadRules(squad.picks, squad.formation);

export const getSquadCost = (picks: FantasySquadPick[]) =>
    Number(picks.reduce((total, pick) => total + Number(pick.player.price || 0), 0).toFixed(1));

export const getRemainingBudget = (picks: FantasySquadPick[]) =>
    Number((INITIAL_BUDGET - getSquadCost(picks)).toFixed(1));
