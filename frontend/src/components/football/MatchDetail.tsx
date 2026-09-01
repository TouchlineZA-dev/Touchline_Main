import { useEffect, useState } from 'react';
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
    ApiLineupPlayer,
    fetchMatchDetail,
    toSast
} from '@/services/touchlineApi';
import { TeamCrest } from './TeamCrest';
import {
    ArrowsLeftRight,
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
const EventIcon = ({ typeId }: { typeId: number }) => {
    switch (typeId) {
        case 14: // goal
        case 16: // penalty scored
            return <SoccerBall size={ICON.inline} weight="fill" />;
        case 15: // own goal
            return <SoccerBall size={ICON.inline} weight="fill" className="text-red-600" />;
        case 17: // penalty missed
            return <XCircle size={ICON.inline} className="text-muted-foreground" />;
        case 18: // substitution
            return <ArrowsLeftRight size={ICON.inline} className="text-muted-foreground" />;
        case 19:
            return <CardMark colour="yellow" />;
        case 20:
            return <CardMark colour="red" />;
        case 21: // second yellow
            return <CardMark colour="red" second />;
        default:
            return <WarningCircle size={ICON.inline} className="text-muted-foreground" />;
    }
};

const minuteLabel = (minute: number | null, extra: number | null) => {
    if (minute === null) return '';
    return extra ? `${minute}+${extra}'` : `${minute}'`;
};

const Timeline = ({ detail }: { detail: ApiMatchDetail }) => {
    if (!detail.events.length) {
        return (
            <p className="py-8 text-center text-sm text-muted-foreground">
                No events recorded for this match.
            </p>
        );
    }

    return (
        <ul className="space-y-1">
            {detail.events.map((event) => (
                <li
                    key={event.id}
                    className="flex items-center gap-3 rounded-md px-2 py-2 text-sm odd:bg-muted/40"
                >
                    <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
                        {minuteLabel(event.minute, event.extraMinute)}
                    </span>
                    <span className="flex w-6 shrink-0 justify-center">
                        <EventIcon typeId={event.typeId} />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="font-medium">{event.player ?? 'Unknown player'}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                            {event.type}
                            {event.relatedPlayer && event.typeId === 18 && ` for ${event.relatedPlayer}`}
                        </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                        {event.team?.shortCode ?? event.team?.name ?? ''}
                    </span>
                </li>
            ))}
        </ul>
    );
};

const LineupColumn = ({
    title,
    starting,
    bench
}: {
    title: string;
    starting: ApiLineupPlayer[];
    bench: ApiLineupPlayer[];
}) => (
    <div className="space-y-3">
        <h4 className="text-sm font-semibold">{title}</h4>

        {starting.length === 0 && bench.length === 0 ? (
            <p className="text-sm text-muted-foreground">Lineup not published.</p>
        ) : (
            <>
                <ul className="space-y-1 text-sm">
                    {starting.map((player) => (
                        <li key={player.id} className="flex items-center gap-2">
                            <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">
                                {player.jerseyNumber ?? ''}
                            </span>
                            <span className="truncate">{player.player ?? 'Unknown'}</span>
                            {player.position && (
                                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                                    {player.position}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>

                {bench.length > 0 && (
                    <div className="space-y-1 border-t pt-2">
                        <p className="text-xs font-medium uppercase text-muted-foreground">Bench</p>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                            {bench.map((player) => (
                                <li key={player.id} className="flex items-center gap-2">
                                    <span className="w-6 shrink-0 text-right tabular-nums">
                                        {player.jerseyNumber ?? ''}
                                    </span>
                                    <span className="truncate">{player.player ?? 'Unknown'}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </>
        )}
    </div>
);

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

                        <TabsContent value="lineups" className="mt-4 grid gap-6 sm:grid-cols-2">
                            <LineupColumn
                                title={detail.fixture.homeTeam?.name ?? 'Home'}
                                starting={detail.lineups.home.starting}
                                bench={detail.lineups.home.bench}
                            />
                            <LineupColumn
                                title={detail.fixture.awayTeam?.name ?? 'Away'}
                                starting={detail.lineups.away.starting}
                                bench={detail.lineups.away.bench}
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
