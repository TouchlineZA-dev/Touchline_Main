import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    ApiFixture,
    ApiMatchDetail,
    ApiMatchEvent,
    fetchMatchDetail,
    toSast
} from '@/services/touchlineApi';
import { TeamCrest } from './TeamCrest';
import { Pitch } from './Pitch';
import { cn } from '@/lib/utils';
import {
    ArrowDown,
    ArrowUp,
    CardMark,
    ICON,
    SoccerBall,
    WarningCircle,
    XCircle
} from './icons';

interface MatchDetailProps {
    fixture: ApiFixture | null;
    onClose: () => void;
}

/**
 * Event glyphs per the icon kit. Own goals reuse the ball but are tinted red,
 * since the kit has no distinct own-goal icon and the label carries the detail.
 */
const GOAL_TYPES = new Set([14, 15, 16]);
const CARD_TYPES = new Set([19, 20, 21]);

const minuteLabel = (minute: number | null, extra: number | null) => {
    if (minute === null) return '';
    return extra ? `${minute}+${extra}'` : `${minute}'`;
};

/** A goal, penalty or own goal. Own goals are tinted red; penalties carry a "P". */
const GoalMark = ({ typeId }: { typeId: number }) => (
    <span className="relative inline-flex">
        <SoccerBall
            size={ICON.inline}
            weight="fill"
            className={typeId === 15 ? 'text-red-600' : 'text-foreground'}
        />
        {typeId === 16 && (
            <span className="absolute -bottom-1 -right-1 rounded-full bg-background px-[2px] text-[8px] font-bold leading-none text-foreground">
                P
            </span>
        )}
    </span>
);

const EventMark = ({ typeId }: { typeId: number }) => {
    if (GOAL_TYPES.has(typeId)) return <GoalMark typeId={typeId} />;
    if (typeId === 19) return <CardMark colour="yellow" />;
    if (typeId === 20) return <CardMark colour="red" />;
    if (typeId === 21) return <CardMark colour="red" second />;
    if (typeId === 17) return <XCircle size={ICON.inline} className="text-muted-foreground" />;
    return <WarningCircle size={ICON.inline} className="text-muted-foreground" />;
};

/**
 * Running score after each goal.
 *
 * Own goals need no special handling: Sportmonks attributes the event to the
 * team that BENEFITS, not to the scorer's own team. Verified against every
 * finished fixture in the current season — crediting `side` directly reconciles
 * all of them, while inverting own goals breaks the three that contain one.
 */
const withRunningScore = (events: ApiMatchEvent[]) => {
    let home = 0;
    let away = 0;
    const scores = new Map<number, string>();

    for (const event of events) {
        if (!GOAL_TYPES.has(event.typeId) || !event.side) continue;

        if (event.side === 'home') home += 1;
        else away += 1;

        scores.set(event.id, `${home} – ${away}`);
    }

    return scores;
};

const MinuteBadge = ({ event }: { event: ApiMatchEvent }) => (
    <span className="z-10 min-w-[2.75rem] rounded-md border bg-background px-2 py-1 text-center text-xs font-medium tabular-nums text-muted-foreground">
        {minuteLabel(event.minute, event.extraMinute) || '—'}
    </span>
);

/** One event, aligned to its team's side of the centre line. */
const TimelineRow = ({
    event,
    score,
    children
}: {
    event: ApiMatchEvent;
    score?: string;
    children?: ReactNode;
}) => {
    const away = event.side === 'away';

    const body = (
        <div className={cn('min-w-0', away ? 'text-left' : 'text-right')}>
            {children ?? (
                <>
                    <p className="truncate text-sm font-medium">
                        {event.player ?? 'Unknown player'}
                        {event.typeId === 16 && ' (P)'}
                    </p>
                    {score ? (
                        <p className="text-xs tabular-nums text-muted-foreground">{score}</p>
                    ) : (
                        event.typeId === 15 && (
                            <p className="text-xs text-muted-foreground">Own goal</p>
                        )
                    )}
                </>
            )}
        </div>
    );

    const mark = (
        <span className="flex shrink-0 items-center justify-center">
            <EventMark typeId={event.typeId} />
        </span>
    );

    return (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2">
            {away ? (
                <span />
            ) : (
                <div className="flex items-center justify-end gap-2">
                    {body}
                    {mark}
                </div>
            )}

            <MinuteBadge event={event} />

            {away ? (
                <div className="flex items-center gap-2">
                    {mark}
                    {body}
                </div>
            ) : (
                <span />
            )}
        </div>
    );
};

/** Substitutions show both players: on in green, off in red. */
const SubstitutionBody = ({ event }: { event: ApiMatchEvent }) => {
    const away = event.side === 'away';
    const rowClass = cn('flex items-center gap-1.5', away ? 'justify-start' : 'justify-end');

    return (
        <div className="min-w-0 space-y-0.5">
            <p className={rowClass}>
                {away && <ArrowUp size={14} weight="bold" className="shrink-0 text-emerald-600" />}
                <span className="truncate text-sm font-medium">
                    {event.player ?? 'Unknown player'}
                </span>
                {!away && <ArrowUp size={14} weight="bold" className="shrink-0 text-emerald-600" />}
            </p>
            <p className={rowClass}>
                {away && <ArrowDown size={14} weight="bold" className="shrink-0 text-red-500" />}
                <span className="truncate text-sm text-muted-foreground">
                    {event.relatedPlayer ?? 'Unknown player'}
                </span>
                {!away && <ArrowDown size={14} weight="bold" className="shrink-0 text-red-500" />}
            </p>
        </div>
    );
};

const LEGEND = [
    { label: 'Goal', mark: <GoalMark typeId={14} /> },
    { label: 'Penalty', mark: <GoalMark typeId={16} /> },
    { label: 'Own goal', mark: <GoalMark typeId={15} /> },
    { label: 'Sub in', mark: <ArrowUp size={14} weight="bold" className="text-emerald-600" /> },
    { label: 'Sub out', mark: <ArrowDown size={14} weight="bold" className="text-red-500" /> },
    { label: 'Yellow card', mark: <CardMark colour="yellow" /> },
    { label: 'Red card', mark: <CardMark colour="red" /> }
];

const Timeline = ({ detail }: { detail: ApiMatchDetail }) => {
    if (!detail.events.length) {
        return (
            <p className="py-8 text-center text-sm text-muted-foreground">
                No events recorded for this match.
            </p>
        );
    }

    const scores = withRunningScore(detail.events);

    // Goals first, then substitutions, then cards — each in minute order, so the
    // scoring narrative reads uninterrupted by bookings and changes.
    const goals = detail.events.filter((e) => GOAL_TYPES.has(e.typeId) || e.typeId === 17);
    const subs = detail.events.filter((e) => e.typeId === 18);
    const cards = detail.events.filter((e) => CARD_TYPES.has(e.typeId));
    const other = detail.events.filter(
        (e) => !GOAL_TYPES.has(e.typeId) && !CARD_TYPES.has(e.typeId) && e.typeId !== 17 && e.typeId !== 18
    );

    const sections = [goals, subs, cards, other].filter((group) => group.length > 0);

    return (
        <div className="space-y-4">
            <div className="relative rounded-lg border p-3">
                {/* the spine every event hangs off */}
                <div
                    className="absolute bottom-3 left-1/2 top-3 w-px -translate-x-1/2 border-l border-dashed"
                    aria-hidden="true"
                />

                {sections.map((group, index) => (
                    <div
                        key={group[0].id}
                        className={cn(index > 0 && 'mt-1 border-t pt-1')}
                    >
                        {group.map((event) =>
                            event.typeId === 18 ? (
                                <TimelineRow key={event.id} event={event}>
                                    <SubstitutionBody event={event} />
                                </TimelineRow>
                            ) : (
                                <TimelineRow
                                    key={event.id}
                                    event={event}
                                    score={scores.get(event.id)}
                                />
                            )
                        )}
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-lg border p-3 text-xs text-muted-foreground">
                {LEGEND.map((item) => (
                    <span key={item.label} className="flex items-center gap-1.5">
                        {item.mark}
                        {item.label}
                    </span>
                ))}
            </div>
        </div>
    );
};

const StatBar = ({ label, home, away }: { label: string; home: number | null; away: number | null }) => {
    const h = home ?? 0;
    const a = away ?? 0;
    const total = h + a;
    const homePct = total > 0 ? (h / total) * 100 : 50;

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
                <span className="font-medium tabular-nums">{home ?? '-'}</span>
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="font-medium tabular-nums">{away ?? '-'}</span>
            </div>
            <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="bg-primary" style={{ width: `${homePct}%` }} />
                <div className="bg-primary/30" style={{ width: `${100 - homePct}%` }} />
            </div>
        </div>
    );
};

export const MatchDetail = ({ fixture, onClose }: MatchDetailProps) => {
    const [detail, setDetail] = useState<ApiMatchDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!fixture) {
            setDetail(null);
            setError(null);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        fetchMatchDetail(fixture.id)
            .then((data) => {
                if (!cancelled) setDetail(data);
            })
            .catch((err: Error) => {
                if (!cancelled) setError(err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [fixture]);

    return (
        <Dialog open={fixture !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-center gap-3 text-base">
                        <span className="flex items-center gap-2">
                            <TeamCrest crest={fixture?.homeCrest} name={fixture?.homeTeam} size={24} />
                            {fixture?.homeTeam}
                        </span>
                        <span className="tabular-nums">
                            {fixture?.homeScore ?? '-'} : {fixture?.awayScore ?? '-'}
                        </span>
                        <span className="flex items-center gap-2">
                            {fixture?.awayTeam}
                            <TeamCrest crest={fixture?.awayCrest} name={fixture?.awayTeam} size={24} />
                        </span>
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        {fixture?.status} · {toSast(fixture?.kickoff ?? null)} (SAST)
                    </DialogDescription>
                </DialogHeader>

                {loading && (
                    <p className="py-10 text-center text-sm text-muted-foreground">Loading match…</p>
                )}

                {error && (
                    <p className="py-10 text-center text-sm text-destructive">
                        Could not load match details: {error}
                    </p>
                )}

                {detail && !loading && !error && (
                    <Tabs defaultValue="events">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="events">Events</TabsTrigger>
                            <TabsTrigger value="lineups">Lineups</TabsTrigger>
                            <TabsTrigger value="stats">Stats</TabsTrigger>
                        </TabsList>

                        <TabsContent value="events" className="mt-4">
                            <Timeline detail={detail} />
                        </TabsContent>

                        <TabsContent value="lineups" className="mt-4 space-y-6">
                            <Pitch
                                team={detail.fixture.homeTeam}
                                starting={detail.lineups.home.starting}
                                bench={detail.lineups.home.bench}
                                events={detail.events.filter((e) => e.side === 'home')}
                            />
                            <Pitch
                                team={detail.fixture.awayTeam}
                                starting={detail.lineups.away.starting}
                                bench={detail.lineups.away.bench}
                                events={detail.events.filter((e) => e.side === 'away')}
                            />
                        </TabsContent>

                        <TabsContent value="stats" className="mt-4 space-y-4">
                            {detail.statistics.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">
                                    No statistics recorded for this match.
                                </p>
                            ) : (
                                <>
                                    {detail.statistics.map((stat) => (
                                        <StatBar
                                            key={stat.typeId}
                                            label={stat.label}
                                            home={stat.home}
                                            away={stat.away}
                                        />
                                    ))}
                                    <p className="border-t pt-3 text-xs text-muted-foreground">
                                        These are team totals. Our current data plan does not provide
                                        dependable per-player statistics such as minutes, saves,
                                        ratings or assists.
                                    </p>
                                </>
                            )}
                        </TabsContent>
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>
    );
};
