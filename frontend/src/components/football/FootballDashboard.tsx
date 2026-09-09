import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
    ArrowRight,
    Broadcast,
    CaretDown,
    CaretLeft,
    CaretRight,
    ChartBar,
    CircleNotch,
    ICON,
    Medal,
    Newspaper,
    Shield,
    Trophy,
    UserCircle,
    Users
} from './icons';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { TeamCrest } from './TeamCrest';
import { StandingsTable } from './StandingsTable';
import { MatchDetail } from './MatchDetail';
import {
    ApiArticle,
    ApiFixture,
    ApiPlayer,
    ApiPlayerRankingRow,
    ApiPlayerRankingsResponse,
    ApiStanding,
    fetchPlayerRankings,
    fetchFixtures,
    fetchNews,
    fetchPlayers,
    fetchStandings,
    isFinished,
    isLive,
    sastDate,
    sastDayKey,
    sastTime
} from '@/services/touchlineApi';
import { useLiveMatchTimer } from './LiveMatchTimer';
import { cn } from '@/lib/utils';

const REFRESH_MS = 60_000;
type Screen = 'news' | 'squad' | 'leagues' | 'table' | 'live';
type PlayerPositionFilter = 'All' | 'GK' | 'DEF' | 'MID' | 'ATT';

const NAV_ITEMS: Array<{ key: Screen; label: string; icon: typeof Newspaper }> = [
    { key: 'news', label: 'News', icon: Newspaper },
    { key: 'squad', label: 'My Squad', icon: Users },
    { key: 'leagues', label: 'Leagues', icon: Trophy },
    { key: 'table', label: 'PSL Table', icon: Shield },
    { key: 'live', label: 'Live Games', icon: Broadcast }
];

const PLAYER_FILTERS: PlayerPositionFilter[] = ['All', 'GK', 'DEF', 'MID', 'ATT'];

const isNonEmptyString = (value: string | null | undefined): value is string =>
    Boolean(value && value.trim().length > 0);

const formatRelativeTime = (iso: string) => {
    const then = Date.parse(iso);
    if (Number.isNaN(then)) return '';

    const minutes = Math.round((Date.now() - then) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;

    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

    const days = Math.round(hours / 24);
    if (days <= 7) return `${days} day${days === 1 ? '' : 's'} ago`;

    return new Date(then).toLocaleDateString('en-ZA', {
        timeZone: 'Africa/Johannesburg',
        day: 'numeric',
        month: 'short'
    });
};

const groupByDay = (fixtures: ApiFixture[]) => {
    const groups = new Map<string, ApiFixture[]>();

    for (const fixture of fixtures) {
        const key = sastDayKey(fixture.kickoff);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)?.push(fixture);
    }

    return [...groups.entries()];
};

type FixtureGameweek = {
    key: string;
    label: string;
    dateRange: string;
    fixtures: ApiFixture[];
};

const sastDateParts = (utcIso: string | null) => {
    if (!utcIso) return null;
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Johannesburg',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date(utcIso));

    const year = Number(parts.find((part) => part.type === 'year')?.value);
    const month = Number(parts.find((part) => part.type === 'month')?.value);
    const day = Number(parts.find((part) => part.type === 'day')?.value);

    if (!year || !month || !day) return null;
    return { year, month, day };
};

const mondayWeekKey = (utcIso: string | null) => {
    const parts = sastDateParts(utcIso);
    if (!parts) return 'unknown';

    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() - day + 1);

    return date.toISOString().slice(0, 10);
};

const formatGameweekRange = (fixtures: ApiFixture[]) => {
    const datedFixtures = fixtures.filter((fixture) => fixture.kickoff);
    const first = datedFixtures[0]?.kickoff ?? null;
    const last = datedFixtures[datedFixtures.length - 1]?.kickoff ?? first;

    if (!first) return 'Dates TBD';
    if (sastDayKey(first) === sastDayKey(last)) return sastDate(first);
    return `${sastDate(first)} - ${sastDate(last)}`;
};

const buildGameweeks = (fixtures: ApiFixture[]): FixtureGameweek[] => {
    const groups = new Map<string, ApiFixture[]>();

    for (const fixture of fixtures) {
        const key = mondayWeekKey(fixture.kickoff);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)?.push(fixture);
    }

    return [...groups.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, group], index) => ({
            key,
            label: key === 'unknown' ? 'Gameweek TBD' : `Gameweek ${index + 1}`,
            dateRange: formatGameweekRange(group),
            fixtures: group
        }));
};

const currentGameweekIndex = (gameweeks: FixtureGameweek[]) => {
    if (!gameweeks.length) return 0;

    const todayKey = new Date().toLocaleDateString('en-CA', {
        timeZone: 'Africa/Johannesburg'
    });
    const currentOrNext = gameweeks.findIndex((gameweek) =>
        gameweek.fixtures.some((fixture) => sastDayKey(fixture.kickoff) >= todayKey)
    );

    return currentOrNext >= 0 ? currentOrNext : gameweeks.length - 1;
};

const getStatusLabel = (fixture: ApiFixture) => {
    if (isFinished(fixture)) return 'FT';
    return fixture.status;
};

const screenBg = 'bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.16),transparent_42%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--background))_100%)]';

const ShellCard = ({
    children,
    className
}: {
    children: ReactNode;
    className?: string;
}) => (
    <div className={cn('rounded-3xl border border-border/70 bg-white/95 shadow-sm backdrop-blur', className)}>
        {children}
    </div>
);

const SectionTitle = ({
    icon: Icon,
    title,
    action,
    subtitle
}: {
    icon: typeof Newspaper;
    title: string;
    subtitle?: string;
    action?: ReactNode;
}) => (
    <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
            <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
            </div>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
    </div>
);

const TeamLine = ({
    crest,
    name,
    score,
    align = 'left',
    highlight = false
}: {
    crest: string | null;
    name: string;
    score: number | null;
    align?: 'left' | 'right';
    highlight?: boolean;
}) => (
    <div className={cn('flex min-w-0 items-center gap-2', align === 'right' && 'justify-end text-right')}>
        {align === 'left' && <TeamCrest crest={crest} name={name} size={24} />}
        <div className={cn('min-w-0', align === 'right' && 'order-2')}>
            <p className="truncate text-sm font-medium leading-tight">{name}</p>
            <p
                className={cn(
                    'text-lg font-semibold tabular-nums leading-none',
                    highlight ? 'font-bold text-red-600' : 'text-foreground/90'
                )}
            >
                {score ?? 0}
            </p>
        </div>
        {align === 'right' && <TeamCrest crest={crest} name={name} size={24} />}
    </div>
);

const NewsCard = ({ article }: { article: ApiArticle }) => {
    const image = article.imageUrl;
    const tag = article.tag || article.source || 'News';

    return (
        <a
            href={article.url}
            target="_blank"
            rel="noreferrer"
            className="group block overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
        >
            {image ? (
                <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                    <img
                        src={image}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/65 to-transparent" />
                    <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
                        {tag}
                    </span>
                </div>
            ) : (
                <div className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                    <Newspaper className="h-12 w-12" />
                </div>
            )}
            <div className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>{article.source ?? 'Touchline News'}</span>
                    <span>{article.publishedAt ? formatRelativeTime(article.publishedAt) : ''}</span>
                </div>
                <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{article.title}</h3>
                {article.summary && (
                    <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {article.summary}
                    </p>
                )}
                <div className="flex items-center gap-2 pt-1 text-xs font-semibold text-primary">
                    <span>View details</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                </div>
            </div>
        </a>
    );
};

const LiveFixtureCard = ({
    fixture,
    onSelect
}: {
    fixture: ApiFixture;
    onSelect: (fixture: ApiFixture) => void;
}) => {
    const live = isLive(fixture);
    const timer = useLiveMatchTimer(fixture.kickoff, fixture.stateId, fixture.scorers);
    const scorers = fixture.scorers ?? [];

    return (
        <button
            type="button"
            onClick={() => onSelect(fixture)}
            className={cn(
                'w-full rounded-2xl border bg-white p-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5',
                live
                    ? 'border-red-500/40 shadow-red-500/5 ring-1 ring-red-500/20'
                    : 'border-border/70'
            )}
        >
            <div className="flex items-center justify-between gap-2">
                {live ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
                        </span>
                        <span>LIVE</span>
                        <span className="tabular-nums font-black">{timer.label}</span>
                    </span>
                ) : (
                    <span
                        className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                            isFinished(fixture)
                                ? 'bg-muted text-muted-foreground'
                                : 'bg-emerald-500/10 text-emerald-700'
                        )}
                    >
                        {getStatusLabel(fixture)}
                    </span>
                )}
                <span
                    className={cn(
                        'text-[11px]',
                        live ? 'font-semibold tabular-nums text-red-600' : 'text-muted-foreground'
                    )}
                >
                    {live
                        ? `${timer.periodLabel} · ${timer.clock}`
                        : fixture.kickoff
                          ? sastTime(fixture.kickoff)
                          : 'TBD'}
                </span>
            </div>
            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <TeamLine
                    crest={fixture.homeCrest}
                    name={fixture.homeTeam}
                    score={fixture.homeScore}
                    align="left"
                    highlight={live}
                />
                {live ? (
                    <div className="flex flex-col items-center gap-0.5 rounded-lg bg-red-500/10 px-2 py-1">
                        <span className="animate-pulse text-xs font-black tabular-nums text-red-600">
                            {timer.label}
                        </span>
                        <span className="text-[8px] font-bold uppercase tracking-wider text-red-600">
                            {timer.period === 'HT' ? 'BREAK' : 'LIVE'}
                        </span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        <span>VS</span>
                        <span>Fixture</span>
                    </div>
                )}
                <TeamLine
                    crest={fixture.awayCrest}
                    name={fixture.awayTeam}
                    score={fixture.awayScore}
                    align="right"
                    highlight={live}
                />
            </div>
            <div className="mt-3 border-t border-border/60 pt-2">
                {scorers.length > 0 ? (
                    <div className="space-y-1">
                        {scorers.map((scorer, index) => (
                            <p
                                key={`${fixture.id}-${scorer.player ?? 'unknown'}-${scorer.minute ?? index}-${index}`}
                                className={cn(
                                    'text-[11px] leading-5 text-muted-foreground',
                                    scorer.side === 'away' && 'text-right'
                                )}
                            >
                                <span className="font-semibold text-foreground">
                                    {scorer.player ?? 'Unknown scorer'}
                                </span>
                                {scorer.minute !== null && (
                                    <span>
                                        {' '}
                                        {scorer.minute}
                                        {scorer.extraMinute ? `+${scorer.extraMinute}` : ''}'
                                    </span>
                                )}
                                {scorer.type !== 'Goal' && <span> · {scorer.type}</span>}
                            </p>
                        ))}
                    </div>
                ) : (
                    <p className="text-[11px] text-muted-foreground">
                        {isFinished(fixture)
                            ? 'No scorers recorded.'
                            : live
                              ? 'Match in progress — scorers will appear here as goals are scored.'
                              : 'Scorers will appear after goals are recorded.'}
                    </p>
                )}
            </div>
        </button>
    );
};

const PlaceholderPanel = ({
    title,
    description,
    primary,
    secondary
}: {
    title: string;
    description: string;
    primary: { label: string; onClick: () => void };
    secondary?: { label: string; onClick: () => void };
}) => (
    <ShellCard className="mx-auto max-w-sm p-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Shield className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={primary.onClick}>
                {primary.label}
            </Button>
            {secondary && (
                <Button variant="outline" className="flex-1" onClick={secondary.onClick}>
                    {secondary.label}
                </Button>
            )}
        </div>
    </ShellCard>
);

const PlayerPoolDialog = ({
    open,
    onOpenChange
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) => {
    const [players, setPlayers] = useState<ApiPlayer[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [position, setPosition] = useState<PlayerPositionFilter>('All');

    useEffect(() => {
        if (!open) return;

        let cancelled = false;
        setLoading(true);
        setError(null);

        fetchPlayers()
            .then((data) => {
                if (!cancelled) setPlayers(data.players);
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
    }, [open]);

    const filteredPlayers = useMemo(() => {
        const lowerQuery = query.trim().toLowerCase();
        return players
            .filter((player) => (position === 'All' ? true : player.position === position))
            .filter((player) => {
                if (!lowerQuery) return true;
                return (
                    player.name.toLowerCase().includes(lowerQuery) ||
                    (player.team ?? '').toLowerCase().includes(lowerQuery)
                );
            })
            .slice(0, 50);
    }, [players, query, position]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[88vh] w-[min(92vw,42rem)] overflow-hidden p-0">
                <div className="border-b bg-primary/5 px-5 py-4">
                    <DialogHeader>
                        <DialogTitle className="text-left">Player pool</DialogTitle>
                        <DialogDescription className="text-left">
                            Browse the current PSL player list. Squad selection is coming soon.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="space-y-4 px-5 py-4">
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search player or club"
                        />
                        <div className="flex flex-wrap gap-2">
                            {PLAYER_FILTERS.map((filter) => (
                                <Button
                                    key={filter}
                                    type="button"
                                    variant={position === filter ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setPosition(filter)}
                                >
                                    {filter}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {loading && (
                        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                            <CircleNotch className="h-4 w-4 animate-spin" />
                            Loading players…
                        </div>
                    )}

                    {error && (
                        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                            Could not load players: {error}
                        </p>
                    )}

                    {!loading && !error && (
                        <div className="max-h-[56vh] space-y-2 overflow-y-auto pr-1">
                            {filteredPlayers.length === 0 ? (
                                <p className="py-10 text-center text-sm text-muted-foreground">
                                    No players match this search.
                                </p>
                            ) : (
                                filteredPlayers.map((player) => (
                                    <div
                                        key={player.id}
                                        className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background px-3 py-3"
                                    >
                                        <TeamCrest crest={player.teamCrest} name={player.team} size={30} />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold">{player.name}</p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {player.team ?? 'No club'} · {player.position}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold tabular-nums">{player.rating}</p>
                                            <p className="text-[11px] text-muted-foreground">
                                                {player.price.toFixed(1)}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

const RankingList = ({
    title,
    statLabel,
    rows,
    emptyMessage
}: {
    title: string;
    statLabel: string;
    rows: ApiPlayerRankingRow[];
    emptyMessage: string;
}) => (
    <ShellCard className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <div className="flex items-center gap-2">
                <Medal className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">{title}</h3>
            </div>
            <span className="text-[11px] font-semibold uppercase text-muted-foreground">Top 10</span>
        </div>

        {rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
            <ol className="divide-y divide-border/70">
                {rows.map((row) => (
                    <li key={`${title}-${row.sportmonksPlayerId}`} className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 px-4 py-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold tabular-nums text-primary">
                            {row.rank}
                        </span>
                        <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                                {row.jerseyNumber !== null && (
                                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                                        #{row.jerseyNumber}
                                    </span>
                                )}
                                <p className="truncate text-sm font-semibold">{row.player}</p>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {row.club ?? 'Club unavailable'}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-bold tabular-nums">{row.total}</p>
                            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                                {statLabel}
                            </p>
                        </div>
                    </li>
                ))}
            </ol>
        )}
    </ShellCard>
);

const TouchlineHeader = ({
    onAccount
}: {
    onAccount: () => void;
}) => (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[28rem] items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary/10">
                    <img src="/touchline-logo.jpg" alt="Touchline SA" className="h-10 w-10 object-cover" />
                </div>
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                        Touchline SA
                    </p>
                </div>
            </div>

            <Button variant="ghost" size="icon" onClick={onAccount} aria-label="Account">
                <UserCircle className="h-5 w-5" />
            </Button>
        </div>
    </header>
);

const BottomNav = ({
    screen,
    onChange,
    liveCount = 0
}: {
    screen: Screen;
    onChange: (screen: Screen) => void;
    liveCount?: number;
}) => (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-[28rem] grid-cols-5 px-2 py-2">
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
                const active = screen === key;
                const hasLive = key === 'live' && liveCount > 0;
                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => onChange(key)}
                        className={cn(
                            'relative flex flex-col items-center gap-1.5 rounded-2xl px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors',
                            active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <span
                            className={cn(
                                'relative flex h-11 w-11 items-center justify-center rounded-full transition-colors',
                                active ? 'bg-primary/10' : 'bg-transparent'
                            )}
                        >
                            <Icon size={ICON.nav} weight={active ? 'fill' : 'regular'} />
                            {hasLive && (
                                <span className="absolute right-1 top-1 flex h-2.5 w-2.5">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
                                </span>
                            )}
                        </span>
                        <span className="leading-none">{label}</span>
                    </button>
                );
            })}
        </div>
    </nav>
);

export const FootballDashboard = () => {
    const [screen, setScreen] = useState<Screen>('news');
    const [fixtures, setFixtures] = useState<ApiFixture[]>([]);
    const [standings, setStandings] = useState<ApiStanding[]>([]);
    const [seasonName, setSeasonName] = useState<string | null>(null);
    const [news, setNews] = useState<ApiArticle[]>([]);
    const [newsLoading, setNewsLoading] = useState(true);
    const [newsError, setNewsError] = useState<string | null>(null);
    const [newsUnavailable, setNewsUnavailable] = useState(false);
    const [coreLoading, setCoreLoading] = useState(true);
    const [coreError, setCoreError] = useState<string | null>(null);
    const [selectedFixture, setSelectedFixture] = useState<ApiFixture | null>(null);
    const [selectedTag, setSelectedTag] = useState<string>('All');
    const [playerPoolOpen, setPlayerPoolOpen] = useState(false);
    const [rankingsData, setRankingsData] = useState<ApiPlayerRankingsResponse | null>(null);
    const [rankingsLoading, setRankingsLoading] = useState(true);
    const [rankingsError, setRankingsError] = useState<string | null>(null);
    const [selectedCompetitionId, setSelectedCompetitionId] = useState<number | undefined>();
    const [selectedSeasonId, setSelectedSeasonId] = useState<number | undefined>();
    const [selectedGameweekIndex, setSelectedGameweekIndex] = useState(-1);
    const [touchStartX, setTouchStartX] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;

        const loadCoreData = async (initial = false) => {
            try {
                const [fixtureData, standingsData] = await Promise.all([
                    fetchFixtures(),
                    fetchStandings()
                ]);

                if (cancelled) return;

                setFixtures(fixtureData.fixtures);
                setStandings(standingsData.standings);
                setSeasonName(fixtureData.season?.name ?? standingsData.season?.name ?? null);
                setCoreError(null);
            } catch (err) {
                if (!cancelled && initial) setCoreError((err as Error).message);
            } finally {
                if (!cancelled && initial) setCoreLoading(false);
            }
        };

        loadCoreData(true);
        const timer = setInterval(() => loadCoreData(false), REFRESH_MS);

        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const loadRankings = async () => {
            setRankingsLoading(true);
            setRankingsError(null);

            try {
                const data = await fetchPlayerRankings({
                    competitionId: selectedCompetitionId,
                    seasonId: selectedSeasonId
                });

                if (cancelled) return;

                setRankingsData(data);
                setSelectedCompetitionId(data.competition.sportmonksCompetitionId);
                setSelectedSeasonId(data.season.id);
            } catch (err) {
                if (!cancelled) setRankingsError((err as Error).message);
            } finally {
                if (!cancelled) setRankingsLoading(false);
            }
        };

        loadRankings();
        return () => {
            cancelled = true;
        };
    }, [selectedCompetitionId, selectedSeasonId]);

    useEffect(() => {
        let cancelled = false;

        const loadNews = async () => {
            try {
                const data = await fetchNews(10);
                if (cancelled) return;
                setNews(data.articles);
                setNewsUnavailable(Boolean(data.unavailable));
                setNewsError(null);
            } catch (err) {
                if (!cancelled) setNewsError((err as Error).message);
            } finally {
                if (!cancelled) setNewsLoading(false);
            }
        };

        loadNews();
        return () => {
            cancelled = true;
        };
    }, []);

    const sortedFixtures = useMemo(
        () => [...fixtures].sort((a, b) => Date.parse(a.kickoff ?? '') - Date.parse(b.kickoff ?? '')),
        [fixtures]
    );

    const liveFixtures = useMemo(
        () => sortedFixtures.filter(isLive),
        [sortedFixtures]
    );

    const upcomingFixtures = useMemo(
        () => sortedFixtures.filter((fixture) => !isFinished(fixture)),
        [sortedFixtures]
    );
    const finishedFixtures = useMemo(() => sortedFixtures.filter(isFinished).reverse(), [sortedFixtures]);
    const fixtureGameweeks = useMemo(() => buildGameweeks(sortedFixtures), [sortedFixtures]);
    const selectedGameweek = fixtureGameweeks[selectedGameweekIndex] ?? fixtureGameweeks[0] ?? null;
    // selectedGameweekIndex starts at -1 ("not chosen yet"), which falls back to
    // the first gameweek above — the arrows need that resolved index.
    const gameweekIndex =
        selectedGameweekIndex >= 0 && selectedGameweekIndex < fixtureGameweeks.length
            ? selectedGameweekIndex
            : 0;
    const stepGameweek = (delta: number) =>
        setSelectedGameweekIndex(
            Math.min(Math.max(gameweekIndex + delta, 0), Math.max(fixtureGameweeks.length - 1, 0))
        );

    useEffect(() => {
        if (!fixtureGameweeks.length) {
            setSelectedGameweekIndex(-1);
            return;
        }

        setSelectedGameweekIndex((current) => {
            if (current >= 0 && current < fixtureGameweeks.length) return current;
            return currentGameweekIndex(fixtureGameweeks);
        });
    }, [fixtureGameweeks]);

    const newsCategories = useMemo(() => {
        const tags = new Set<string>();
        for (const article of news) {
            if (isNonEmptyString(article.tag)) tags.add(article.tag.trim());
        }

        const values = [...tags].sort((a, b) => a.localeCompare(b));
        return ['All', ...values];
    }, [news]);

    useEffect(() => {
        if (!newsCategories.includes(selectedTag)) {
            setSelectedTag('All');
        }
    }, [newsCategories, selectedTag]);

    const filteredNews = useMemo(() => {
        if (selectedTag === 'All') return news;
        return news.filter((article) => article.tag?.trim() === selectedTag);
    }, [news, selectedTag]);

    const featuredNews = filteredNews[0] ?? null;
    const restNews = filteredNews.slice(1);
    const changeScreen = (nextScreen: Screen) => {
        if (nextScreen === 'live' && fixtureGameweeks.length > 0) {
            setSelectedGameweekIndex(currentGameweekIndex(fixtureGameweeks));
        }
        setScreen(nextScreen);
    };

    const renderNews = () => (
        <div className="space-y-4">
            <ShellCard className="relative overflow-hidden border-emerald-700/20 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_0_8%,transparent_8%_16%),linear-gradient(135deg,#2fbf73,#0f8f4e)] text-white">
                <div className="pointer-events-none absolute inset-3 rounded-2xl border border-white/25" />
                <div className="pointer-events-none absolute left-1/2 top-3 h-[calc(100%-1.5rem)] w-px bg-white/20" />
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
                <div className="pointer-events-none absolute -left-4 top-1/2 h-20 w-12 -translate-y-1/2 rounded-r-full border border-l-0 border-white/20" />
                <div className="pointer-events-none absolute -right-4 top-1/2 h-20 w-12 -translate-y-1/2 rounded-l-full border border-r-0 border-white/20" />
                <div className="relative p-4">
                    <SectionTitle
                        icon={Newspaper}
                        title="News"
                        subtitle="Your daily digest of South African football"
                    />

                    <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {newsCategories.map((tag) => {
                            const active = selectedTag === tag;
                            return (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => setSelectedTag(tag)}
                                    className={cn(
                                        'whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors',
                                        active
                                            ? 'border-white bg-white text-primary'
                                            : 'border-white/40 bg-white/10 text-white hover:bg-white/15'
                                    )}
                                >
                                    {tag}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </ShellCard>

            {newsLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                    <CircleNotch className="h-4 w-4 animate-spin" />
                    Loading news…
                </div>
            ) : newsError ? (
                <ShellCard className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                    Could not load news: {newsError}
                </ShellCard>
            ) : newsUnavailable || !news.length ? (
                <ShellCard className="p-5 text-center">
                    <p className="text-sm text-muted-foreground">
                        No headlines are available right now. The news cache will populate once the
                        sync worker publishes new stories.
                    </p>
                </ShellCard>
            ) : selectedTag !== 'All' && filteredNews.length === 0 ? (
                <ShellCard className="p-5 text-center">
                    <p className="text-sm text-muted-foreground">
                        No stories match the selected category right now.
                    </p>
                    <Button variant="ghost" className="mt-3" onClick={() => setSelectedTag('All')}>
                        Show all news
                    </Button>
                </ShellCard>
            ) : (
                <>
                    {featuredNews && <NewsCard article={featuredNews} />}

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                Latest stories
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {filteredNews.length} {filteredNews.length === 1 ? 'story' : 'stories'}
                            </p>
                        </div>
                        <div className="space-y-3">
                            {restNews.map((article) => (
                                <NewsCard key={`${article.url}-${article.title}`} article={article} />
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );

    const renderSquad = () => (
        <div className="space-y-4">
            <PlaceholderPanel
                title="My Squad Coming Soon"
                description="Squad management is coming soon. For now, you can keep exploring players, fixtures, and the PSL table without getting stuck."
                primary={{
                    label: 'Browse player pool',
                    onClick: () => setPlayerPoolOpen(true)
                }}
                secondary={{
                    label: 'Open PSL table',
                    onClick: () => setScreen('table')
                }}
            />

            <ShellCard className="p-4">
                <SectionTitle
                    icon={Users}
                    title="What you can do now"
                    subtitle="These buttons are wired to the parts of the app that already work."
                />
                <div className="mt-4 grid gap-2">
                    <Button variant="outline" className="justify-between" onClick={() => setScreen('live')}>
                        <span>See live games</span>
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </div>
            </ShellCard>
        </div>
    );

    const renderLeagues = () => (
        <div className="space-y-4">
            <ShellCard className="p-4">
                <SectionTitle
                    icon={ChartBar}
                    title="TOP PLAYER STATISTICS"
                    subtitle="Rankings from completed matches in the selected competition and season."
                />

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1.5">
                        <span className="text-[11px] font-semibold uppercase text-muted-foreground">
                            League
                        </span>
                        <div className="relative">
                            <select
                                value={selectedCompetitionId ?? ''}
                                onChange={(event) => {
                                    const nextCompetitionId = Number(event.target.value);
                                    setSelectedCompetitionId(nextCompetitionId);
                                    setSelectedSeasonId(undefined);
                                }}
                                className="h-10 w-full appearance-none rounded-lg border border-input bg-background px-3 pr-9 text-sm"
                                disabled={rankingsLoading && !rankingsData}
                            >
                                {rankingsData?.competitions.map((competition) => (
                                    <option
                                        key={competition.sportmonksCompetitionId}
                                        value={competition.sportmonksCompetitionId}
                                    >
                                        {competition.shortCode === 'ZAF PL'
                                            ? 'PSL'
                                            : competition.shortCode || competition.name}
                                    </option>
                                ))}
                            </select>
                            <CaretDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        </div>
                    </label>

                    <label className="space-y-1.5">
                        <span className="text-[11px] font-semibold uppercase text-muted-foreground">
                            Season
                        </span>
                        <div className="relative">
                            <select
                                value={selectedSeasonId ?? ''}
                                onChange={(event) => setSelectedSeasonId(Number(event.target.value))}
                                className="h-10 w-full appearance-none rounded-lg border border-input bg-background px-3 pr-9 text-sm"
                                disabled={rankingsLoading && !rankingsData}
                            >
                                {rankingsData?.seasons.map((season) => (
                                    <option key={season.id} value={season.id}>
                                        {season.name}
                                    </option>
                                ))}
                            </select>
                            <CaretDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        </div>
                    </label>
                </div>

                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    {rankingsLoading ? (
                        <>
                            <CircleNotch className="h-3.5 w-3.5 animate-spin" />
                            <span>Loading rankings...</span>
                        </>
                    ) : (
                        <span>{rankingsData?.matchesCounted ?? 0} completed matches counted</span>
                    )}
                </div>
            </ShellCard>

            {rankingsError && (
                <ShellCard className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                    Could not load player rankings: {rankingsError}
                </ShellCard>
            )}

            {!rankingsError && rankingsLoading && !rankingsData ? (
                <ShellCard className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                    <CircleNotch className="h-4 w-4 animate-spin" />
                    Loading player statistics...
                </ShellCard>
            ) : (
                <div className="grid gap-4">
                    <RankingList
                        title="Goals"
                        statLabel="Goals"
                        rows={rankingsData?.rankings.goals ?? []}
                        emptyMessage="No goal scorers are available for this selection."
                    />
                    <RankingList
                        title="Assists"
                        statLabel="Assists"
                        rows={rankingsData?.rankings.assists ?? []}
                        emptyMessage="No player-level assists are available for this selection."
                    />
                    <RankingList
                        title="Clean Sheets"
                        statLabel="Clean Sheets"
                        rows={rankingsData?.rankings.cleanSheets ?? []}
                        emptyMessage="No clean sheets are available for this selection."
                    />
                </div>
            )}
        </div>
    );

    const renderTable = () => (
        <div className="space-y-4">
            <ShellCard className="p-4">
                <SectionTitle
                    icon={Shield}
                    title="PSL Table"
                    subtitle="League standings are calculated from completed matches only."
                />

                <div className="mt-4 flex items-center gap-2">
                    <div className="relative">
                        <select
                            value={seasonName ?? ''}
                            disabled
                            className="h-9 rounded-full border border-input bg-background px-3 pr-9 text-sm"
                        >
                            <option value={seasonName ?? ''}>{seasonName ?? 'Current season'}</option>
                        </select>
                        <CaretDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                    <span className="text-xs text-muted-foreground">
                        {coreLoading ? 'Updating table…' : `${standings.length} teams`}
                    </span>
                </div>
            </ShellCard>

            {coreError && (
                <ShellCard className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                    Could not load table data: {coreError}
                </ShellCard>
            )}

            <ShellCard className="overflow-hidden">
                {coreLoading && standings.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                        <CircleNotch className="h-4 w-4 animate-spin" />
                        Loading table…
                    </div>
                ) : (
                    <div className="p-3">
                        <StandingsTable standings={standings} />
                    </div>
                )}
            </ShellCard>
        </div>
    );

    const renderLive = () => (
        <div className="space-y-4">
            {coreError && (
                <ShellCard className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                    Could not load live fixtures: {coreError}
                </ShellCard>
            )}

            {liveFixtures.length > 0 && (
                <div className="space-y-2 rounded-2xl border border-red-500/30 bg-red-500/5 p-3">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
                            </span>
                            <span className="text-xs font-bold uppercase tracking-wider text-red-700">
                                Live Now ({liveFixtures.length})
                            </span>
                        </div>
                        <span className="animate-pulse text-[10px] font-semibold uppercase tracking-wider text-red-600">
                            Live Timers Active
                        </span>
                    </div>
                    <div className="space-y-2.5">
                        {liveFixtures.map((fixture) => (
                            <LiveFixtureCard
                                key={`live-featured-${fixture.id}`}
                                fixture={fixture}
                                onSelect={setSelectedFixture}
                            />
                        ))}
                    </div>
                </div>
            )}

            <section
                className="space-y-3"
                onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
                onTouchEnd={(event) => {
                    if (touchStartX === null) return;
                    const endX = event.changedTouches[0]?.clientX ?? touchStartX;
                    const delta = endX - touchStartX;
                    setTouchStartX(null);

                    if (Math.abs(delta) < 48) return;
                    setSelectedGameweekIndex((current) => {
                        if (delta > 0) return Math.max(0, current - 1);
                        return Math.min(fixtureGameweeks.length - 1, current + 1);
                    });
                }}
            >
                {coreLoading && sortedFixtures.length === 0 ? (
                    <ShellCard className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                        <CircleNotch className="h-4 w-4 animate-spin" />
                        Loading fixtures…
                    </ShellCard>
                ) : !selectedGameweek ? (
                    <ShellCard className="p-5 text-center text-sm text-muted-foreground">
                        No fixtures available right now.
                    </ShellCard>
                ) : (
                    <>
                        <ShellCard className="p-4">
                            <div className="flex items-center justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={() => stepGameweek(-1)}
                                    disabled={gameweekIndex <= 0}
                                    aria-label="Previous gameweek"
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-primary transition-colors hover:bg-emerald-500/20 disabled:pointer-events-none disabled:opacity-25"
                                >
                                    <CaretLeft size={ICON.action} weight="bold" />
                                </button>

                                <div className="min-w-0 text-center">
                                    <p className="truncate text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                                        {selectedGameweek.label}
                                    </p>
                                    {selectedGameweek.dateRange && (
                                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                            {selectedGameweek.dateRange}
                                        </p>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => stepGameweek(1)}
                                    disabled={gameweekIndex >= fixtureGameweeks.length - 1}
                                    aria-label="Next gameweek"
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-primary transition-colors hover:bg-emerald-500/20 disabled:pointer-events-none disabled:opacity-25"
                                >
                                    <CaretRight size={ICON.action} weight="bold" />
                                </button>
                            </div>
                        </ShellCard>

                        <div className="space-y-4">
                            {groupByDay(selectedGameweek.fixtures).map(([day, dayFixtures]) => (
                                <div key={day} className="space-y-2">
                                    <div className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                                        {sastDate(dayFixtures[0].kickoff)}
                                    </div>
                                    <div className="space-y-3">
                                        {dayFixtures.map((fixture) => (
                                            <LiveFixtureCard
                                                key={fixture.id}
                                                fixture={fixture}
                                                onSelect={setSelectedFixture}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </section>
        </div>
    );

    const currentScreen = () => {
        switch (screen) {
            case 'squad':
                return renderSquad();
            case 'leagues':
                return renderLeagues();
            case 'table':
                return renderTable();
            case 'live':
                return renderLive();
            case 'news':
            default:
                return renderNews();
        }
    };

    return (
        <div className={cn('min-h-screen pb-24', screenBg)}>
            <TouchlineHeader
                onAccount={() =>
                    toast('Account area is not wired yet. Tell me what should live behind this button.')
                }
            />

            <main className="mx-auto max-w-[28rem] px-4 py-4">
                {currentScreen()}
            </main>

            <BottomNav screen={screen} onChange={changeScreen} liveCount={liveFixtures.length} />
            <MatchDetail fixture={selectedFixture} onClose={() => setSelectedFixture(null)} />
            <PlayerPoolDialog open={playerPoolOpen} onOpenChange={setPlayerPoolOpen} />
        </div>
    );
};

export default FootballDashboard;
