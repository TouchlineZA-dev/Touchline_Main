import { ApiLineupPlayer, ApiMatchEvent, ApiTeamRef } from '@/services/touchlineApi';
import { TeamCrest } from './TeamCrest';
import { ArrowDown, ArrowUp, CardMark, SoccerBall } from './icons';
import { cn } from '@/lib/utils';

/** Sportmonks position ids, back to front. */
const ROW_ORDER = [24, 25, 26, 27] as const;

const POSITION_NAMES: Record<number, string> = {
    24: 'Goalkeeper',
    25: 'Defender',
    26: 'Midfielder',
    27: 'Attacker'
};

interface PlayerMarks {
    goals: number;
    ownGoals: number;
    penalties: number;
    yellow: boolean;
    red: boolean;
    subbedOffAt: string | null;
    subbedOnAt: string | null;
}

const emptyMarks = (): PlayerMarks => ({
    goals: 0,
    ownGoals: 0,
    penalties: 0,
    yellow: false,
    red: false,
    subbedOffAt: null,
    subbedOnAt: null
});

const minuteLabel = (minute: number | null, extra: number | null) =>
    minute === null ? '' : extra ? `${minute}+${extra}'` : `${minute}'`;

/**
 * Index events by Sportmonks player id.
 *
 * A substitution names the player coming on, so the player going off is found
 * through the related id.
 */
const collectMarks = (events: ApiMatchEvent[]) => {
    const marks = new Map<number, PlayerMarks>();
    const at = (id: number | null) => {
        if (id === null) return null;
        if (!marks.has(id)) marks.set(id, emptyMarks());
        return marks.get(id);
    };

    for (const event of events) {
        const player = at(event.sportmonksPlayerId);
        const minute = minuteLabel(event.minute, event.extraMinute);

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
                if (player) player.subbedOnAt = minute;
                const off = at(event.relatedSportmonksPlayerId);
                if (off) off.subbedOffAt = minute;
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

const GoalBadge = ({ marks }: { marks: PlayerMarks }) => {
    const count = marks.goals + marks.penalties;
    if (count === 0) return null;

    return (
        <span className="absolute -bottom-0.5 -right-1 flex items-center gap-0.5 rounded-full bg-white px-1 py-0.5 shadow">
            <SoccerBall size={11} weight="fill" className="text-emerald-900" />
            {count > 1 && <span className="text-[9px] font-bold leading-none">{count}</span>}
        </span>
    );
};

const PlayerToken = ({ player, marks }: { player: ApiLineupPlayer; marks?: PlayerMarks }) => (
    <div className="flex w-[4.25rem] flex-col items-center gap-1.5">
        <div className="relative">
            {/* Shirt numbers rather than photos for now: they read better at this
                size and never 404. */}
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-sm font-bold text-emerald-900 shadow-[0_2px_8px_rgba(0,0,0,0.3)] ring-1 ring-black/5">
                {player.jerseyNumber ?? '–'}
            </div>

            {marks && <GoalBadge marks={marks} />}

            {(marks?.ownGoals ?? 0) > 0 && (
                <span className="absolute -bottom-0.5 -left-1 rounded-full bg-white p-0.5 shadow">
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
                    <span className="text-[9px] font-semibold leading-none text-emerald-900">
                        {marks.subbedOffAt}
                    </span>
                </span>
            )}
        </div>

        <span className="max-w-full truncate rounded-full bg-black/35 px-2 py-0.5 text-center text-[11px] font-medium leading-tight text-white backdrop-blur-[2px]">
            {shortName(player.player)}
        </span>
    </div>
);

/** Starting XI grouped into rows, with stragglers pushed into the front line. */
const toRows = (starting: ApiLineupPlayer[]) => {
    const rows = ROW_ORDER.map((id) => ({
        id,
        players: starting.filter((p) => p.positionId === id)
    }));

    const placed = new Set(rows.flatMap((r) => r.players.map((p) => p.id)));
    const unplaced = starting.filter((p) => !placed.has(p.id));
    if (unplaced.length) rows[rows.length - 1].players.push(...unplaced);

    return rows.filter((row) => row.players.length > 0);
};

const formationOf = (starting: ApiLineupPlayer[]) =>
    toRows(starting)
        .filter((row) => row.id !== 24)
        .map((row) => row.players.length)
        .join('-');

const TeamHalf = ({
    starting,
    marks,
    mirrored
}: {
    starting: ApiLineupPlayer[];
    marks: Map<number, PlayerMarks>;
    /** The away half runs front-line-first, so both teams attack the centre. */
    mirrored?: boolean;
}) => {
    const rows = toRows(starting);
    const ordered = mirrored ? [...rows].reverse() : rows;

    return (
        <div className="flex flex-1 flex-col justify-around gap-2 py-6">
            {ordered.map((row) => (
                <div key={row.id} className="flex items-start justify-evenly gap-x-1 gap-y-3 px-1">
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
    );
};

const TeamLabel = ({
    team,
    formation,
    className
}: {
    team: ApiTeamRef | null;
    formation: string;
    className?: string;
}) => (
    <div
        className={cn(
            'flex items-center gap-2 rounded-full bg-black/35 px-3 py-1 backdrop-blur-[2px]',
            className
        )}
    >
        <TeamCrest crest={team?.crest} name={team?.name} size={18} />
        <span className="text-xs font-semibold text-white">{team?.name ?? 'Team'}</span>
        {formation && (
            <span className="text-xs font-medium tabular-nums text-white/70">{formation}</span>
        )}
    </div>
);

const BenchColumn = ({
    team,
    bench,
    marks
}: {
    team: ApiTeamRef | null;
    bench: ApiLineupPlayer[];
    marks: Map<number, PlayerMarks>;
}) => (
    <div className="space-y-2">
        <div className="flex items-center gap-2">
            <TeamCrest crest={team?.crest} name={team?.name} size={18} />
            <span className="text-sm font-semibold">{team?.name ?? 'Team'}</span>
        </div>

        {bench.length === 0 ? (
            <p className="text-sm text-muted-foreground">No substitutes listed.</p>
        ) : (
            <ul className="space-y-1.5">
                {bench.map((player) => {
                    const mark = marks.get(player.sportmonksPlayerId);
                    return (
                        <li key={player.id} className="flex items-center gap-2 text-sm">
                            <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                                {player.jerseyNumber ?? ''}
                            </span>

                            <span className="min-w-0 flex-1">
                                <span
                                    className={cn(
                                        'block truncate',
                                        mark?.subbedOnAt ? 'font-medium' : 'text-muted-foreground'
                                    )}
                                >
                                    {player.player ?? 'Unknown'}
                                </span>
                                {player.positionId && POSITION_NAMES[player.positionId] && (
                                    <span className="block text-xs text-muted-foreground">
                                        {POSITION_NAMES[player.positionId]}
                                    </span>
                                )}
                            </span>

                            <span className="flex shrink-0 items-center gap-1">
                                {(mark?.goals ?? 0) + (mark?.penalties ?? 0) > 0 && (
                                    <SoccerBall size={12} weight="fill" />
                                )}
                                {(mark?.yellow || mark?.red) && (
                                    <CardMark colour={mark.red ? 'red' : 'yellow'} />
                                )}
                                {mark?.subbedOnAt && (
                                    <span className="flex items-center gap-0.5 text-xs text-emerald-600">
                                        <ArrowUp size={11} weight="bold" />
                                        <span className="tabular-nums">{mark.subbedOnAt}</span>
                                    </span>
                                )}
                            </span>
                        </li>
                    );
                })}
            </ul>
        )}
    </div>
);

export const Pitch = ({
    homeTeam,
    awayTeam,
    lineups,
    events
}: {
    homeTeam: ApiTeamRef | null;
    awayTeam: ApiTeamRef | null;
    lineups: {
        home: { starting: ApiLineupPlayer[]; bench: ApiLineupPlayer[] };
        away: { starting: ApiLineupPlayer[]; bench: ApiLineupPlayer[] };
    };
    events: ApiMatchEvent[];
}) => {
    const marks = collectMarks(events);
    const { home, away } = lineups;

    if (!home.starting.length && !away.starting.length) {
        return (
            <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                Lineups have not been published for this match.
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="relative isolate overflow-hidden rounded-xl bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-600 shadow-inner">
                {/* Mown stripes. */}
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.12]"
                    style={{
                        backgroundImage:
                            'repeating-linear-gradient(180deg, #fff 0 6%, transparent 6% 12%)'
                    }}
                    aria-hidden="true"
                />

                {/* Full pitch: a goal at each end, halfway line through the middle. */}
                <div className="pointer-events-none absolute inset-0 text-white/30" aria-hidden="true">
                    <div className="absolute inset-2 rounded-lg border-2 border-current" />
                    <div className="absolute left-1/2 top-2 h-20 w-[52%] -translate-x-1/2 rounded-b-md border-x-2 border-b-2 border-current" />
                    <div className="absolute left-1/2 top-2 h-8 w-[26%] -translate-x-1/2 rounded-b-md border-x-2 border-b-2 border-current" />
                    <div className="absolute bottom-2 left-1/2 h-20 w-[52%] -translate-x-1/2 rounded-t-md border-x-2 border-t-2 border-current" />
                    <div className="absolute bottom-2 left-1/2 h-8 w-[26%] -translate-x-1/2 rounded-t-md border-x-2 border-t-2 border-current" />
                    <div className="absolute inset-x-2 top-1/2 border-t-2 border-current" />
                    <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-current" />
                    <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
                </div>

                <TeamLabel
                    team={homeTeam}
                    formation={formationOf(home.starting)}
                    className="absolute left-3 top-3 z-10"
                />
                <TeamLabel
                    team={awayTeam}
                    formation={formationOf(away.starting)}
                    className="absolute bottom-3 right-3 z-10"
                />

                <div className="relative flex min-h-[46rem] flex-col">
                    <TeamHalf starting={home.starting} marks={marks} />
                    <TeamHalf starting={away.starting} marks={marks} mirrored />
                </div>
            </div>

            <div className="rounded-xl border p-4">
                <h4 className="mb-3 text-sm font-semibold">Bench</h4>
                <div className="grid gap-6 sm:grid-cols-2">
                    <BenchColumn team={homeTeam} bench={home.bench} marks={marks} />
                    <BenchColumn team={awayTeam} bench={away.bench} marks={marks} />
                </div>
            </div>
        </div>
    );
};
