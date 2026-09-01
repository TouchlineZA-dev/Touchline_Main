import { ApiLineupPlayer, ApiMatchEvent, ApiTeamRef } from '@/services/touchlineApi';
import { TeamCrest } from './TeamCrest';
import { ArrowDown, CardMark, SoccerBall } from './icons';
import { cn } from '@/lib/utils';

/** Sportmonks position ids, goalkeeper first — the order rows are drawn in. */
const ROWS = [
    { id: 24, label: 'GK' },
    { id: 25, label: 'DEF' },
    { id: 26, label: 'MID' },
    { id: 27, label: 'ATT' }
] as const;

/** Marks earned during the match, collected per player. */
interface PlayerMarks {
    goals: number;
    ownGoals: number;
    penalties: number;
    yellow: boolean;
    red: boolean;
    subbedOffAt: string | null;
}

const emptyMarks = (): PlayerMarks => ({
    goals: 0,
    ownGoals: 0,
    penalties: 0,
    yellow: false,
    red: false,
    subbedOffAt: null
});

const minuteLabel = (minute: number | null, extra: number | null) =>
    minute === null ? '' : extra ? `${minute}+${extra}'` : `${minute}'`;

/**
 * Index events by Sportmonks player id.
 *
 * A substitution names the player coming on, so the player going off is found
 * through the related id — that is who gets the "off" marker on the pitch.
 */
export const collectMarks = (events: ApiMatchEvent[]) => {
    const marks = new Map<number, PlayerMarks>();
    const at = (id: number | null) => {
        if (id === null) return null;
        if (!marks.has(id)) marks.set(id, emptyMarks());
        return marks.get(id);
    };

    for (const event of events) {
        const player = at(event.sportmonksPlayerId);

        switch (event.typeId) {
            case 14:
                if (player) player.goals += 1;
                break;
            case 16:
                if (player) player.penalties += 1;
                break;
            case 15:
                if (player) player.ownGoals += 1;
                break;
            case 19:
                if (player) player.yellow = true;
                break;
            case 20:
            case 21:
                if (player) player.red = true;
                break;
            case 18: {
                const off = at(event.relatedSportmonksPlayerId);
                if (off) off.subbedOffAt = minuteLabel(event.minute, event.extraMinute);
                break;
            }
        }
    }

    return marks;
};

/** Surname only — full names do not fit under a token. */
const shortName = (name: string | null) => {
    if (!name) return 'Unknown';
    const parts = name.trim().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : parts[0];
};

const PlayerToken = ({
    player,
    marks
}: {
    player: ApiLineupPlayer;
    marks?: PlayerMarks;
}) => {
    const goalCount = (marks?.goals ?? 0) + (marks?.penalties ?? 0);

    return (
        <div className="flex w-16 flex-col items-center gap-1">
            <div className="relative">
                {/* Photos are deliberately not used yet — the shirt number reads
                    better at this size and never 404s. */}
                <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/70 bg-white/15 text-sm font-semibold text-white shadow-sm backdrop-blur-[1px]">
                    {player.jerseyNumber ?? '–'}
                </div>

                {goalCount > 0 && (
                    <span className="absolute -bottom-0.5 -right-1 flex items-center gap-0.5 rounded-full bg-white px-1 py-0.5 shadow">
                        <SoccerBall size={11} weight="fill" className="text-foreground" />
                        {goalCount > 1 && (
                            <span className="text-[9px] font-bold leading-none">{goalCount}</span>
                        )}
                    </span>
                )}

                {(marks?.ownGoals ?? 0) > 0 && (
                    <span className="absolute -bottom-0.5 left-[-4px] rounded-full bg-white p-0.5 shadow">
                        <SoccerBall size={11} weight="fill" className="text-red-600" />
                    </span>
                )}

                {(marks?.yellow || marks?.red) && (
                    <span className="absolute -left-1.5 top-0 rounded-[2px] bg-white p-[1px] shadow">
                        <CardMark colour={marks.red ? 'red' : 'yellow'} />
                    </span>
                )}

                {marks?.subbedOffAt && (
                    <span className="absolute -right-2 -top-1 flex items-center gap-0.5 rounded-full bg-white px-1 shadow">
                        <ArrowDown size={9} weight="bold" className="text-red-500" />
                        <span className="text-[9px] font-semibold leading-none text-foreground">
                            {marks.subbedOffAt}
                        </span>
                    </span>
                )}
            </div>

            <span className="w-full truncate text-center text-[11px] font-medium text-white drop-shadow">
                {shortName(player.player)}
            </span>
        </div>
    );
};

export const Pitch = ({
    team,
    starting,
    bench,
    events
}: {
    team: ApiTeamRef | null;
    starting: ApiLineupPlayer[];
    bench: ApiLineupPlayer[];
    events: ApiMatchEvent[];
}) => {
    if (!starting.length) {
        return (
            <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                Lineup not published for {team?.name ?? 'this team'}.
            </div>
        );
    }

    const marks = collectMarks(events);
    const rows = ROWS.map((row) => ({
        ...row,
        players: starting.filter((p) => p.positionId === row.id)
    }));

    // Anyone with an unrecognised position id still has to appear somewhere.
    const placed = new Set(rows.flatMap((r) => r.players.map((p) => p.id)));
    const unplaced = starting.filter((p) => !placed.has(p.id));
    if (unplaced.length) {
        rows[rows.length - 1].players.push(...unplaced);
    }

    // Outfield row counts, back to front — "4-4-2" and so on.
    const formation = rows
        .filter((row) => row.id !== 24 && row.players.length > 0)
        .map((row) => row.players.length)
        .join('-');

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <TeamCrest crest={team?.crest} name={team?.name} size={22} />
                <h4 className="text-sm font-semibold">{team?.name ?? 'Team'}</h4>
                {formation && (
                    <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                        {formation}
                    </span>
                )}
            </div>

            <div className="relative overflow-hidden rounded-lg bg-gradient-to-b from-emerald-700 to-emerald-800 py-5">
                {/* Pitch markings, purely decorative. */}
                <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                    <div className="absolute inset-x-0 top-0 mx-auto h-14 w-2/5 rounded-b border-x-2 border-b-2 border-white/25" />
                    <div className="absolute inset-x-0 bottom-0 mx-auto h-0 w-1/2 border-t-2 border-white/25" />
                    <div className="absolute bottom-0 left-1/2 h-16 w-16 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white/25" />
                </div>

                <div className="relative space-y-5">
                    {rows
                        .filter((row) => row.players.length > 0)
                        .map((row) => (
                            <div
                                key={row.id}
                                className="flex flex-wrap items-start justify-center gap-x-2 gap-y-3 px-2"
                            >
                                {row.players.map((player) => (
                                    <PlayerToken
                                        key={player.id}
                                        player={player}
                                        marks={marks.get(player.sportmonksPlayerId)}
                                    />
                                ))}
                            </div>
                        ))}
                </div>
            </div>

            {bench.length > 0 && (
                <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Bench
                    </p>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {bench.map((player) => (
                            <li key={player.id} className="flex items-center gap-1.5">
                                <span className="w-5 text-right text-xs tabular-nums">
                                    {player.jerseyNumber ?? ''}
                                </span>
                                <span className={cn(marks.get(player.sportmonksPlayerId) && 'text-foreground')}>
                                    {player.player ?? 'Unknown'}
                                </span>
                                {(marks.get(player.sportmonksPlayerId)?.goals ?? 0) > 0 && (
                                    <SoccerBall size={11} weight="fill" className="text-foreground" />
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
