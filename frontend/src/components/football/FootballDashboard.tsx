import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
    ArrowRight,
    ChevronDown,
    Loader2,
    Newspaper,
    RefreshCw,
    Shield,
    ShieldHalf,
    Trophy,
    UserCircle2,
    Users,
    Radio
} from 'lucide-react';
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
    ApiStanding,
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
import { cn } from '@/lib/utils';

const REFRESH_MS = 60_000;
const SCREEN_LABELS = {
    news: 'Home/News',
    squad: 'My Squad',
    leagues: 'Leagues',
    table: 'PSL Table',
    live: 'Live Games'
} as const;

type Screen = keyof typeof SCREEN_LABELS;
type PlayerPositionFilter = 'All' | 'GK' | 'DEF' | 'MID' | 'ATT';

const NAV_ITEMS: Array<{ key: Screen; label: string; icon: typeof Newspaper }> = [
    { key: 'news', label: 'News', icon: Newspaper },
    { key: 'squad', label: 'My Squad', icon: Users },
    { key: 'leagues', label: 'Leagues', icon: Trophy },
    { key: 'table', label: 'PSL Table', icon: ShieldHalf },
    { key: 'live', label: 'Live Games', icon: Radio }
];

const TAG_FALLBACKS = ['All', 'Breaking', 'Transfers', 'PSL Giants', 'National Team', 'Management'];
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

const getStatusLabel = (fixture: ApiFixture) => {
    if (isLive(fixture)) return 'LIVE';
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
    align = 'left'
}: {
    crest: string | null;
    name: string;
    score: number | null;
    align?: 'left' | 'right';
}) => (
    <div className={cn('flex min-w-0 items-center gap-2', align === 'right' && 'justify-end text-right')}>
        {align === 'left' && <TeamCrest crest={crest} name={name} size={24} />}
        <div className={cn('min-w-0', align === 'right' && 'order-2')}>
            <p className="truncate text-sm font-medium leading-tight">{name}</p>
            <p className="text-lg font-semibold tabular-nums leading-none text-foreground/90">
                {score ?? 0}
            </p>
        </div>
        {align === 'right' && <TeamCrest crest={crest} name={name} size={24} />}
    </div>
);

const NewsCard = ({ article }: { article: ApiArticle }) => {
    const image = article.imageUrl || article.image;
    const tag = article.tag || 'General';

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
                    <span>{article.source?.name ?? 'Touchline News'}</span>
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

    return (
        <button
            type="button"
            onClick={() => onSelect(fixture)}
            className="w-full rounded-2xl border border-border/70 bg-white p-3 text-left shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
        >
            <div className="flex items-center justify-between gap-2">
                <span
                    className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        live
                            ? 'bg-red-500/10 text-red-600'
                            : isFinished(fixture)
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-emerald-500/10 text-emerald-700'
                    )}
                >
                    {getStatusLabel(fixture)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                    {fixture.kickoff ? sastTime(fixture.kickoff) : 'TBD'}
                </span>
            </div>
            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <TeamLine
                    crest={fixture.homeCrest}
                    name={fixture.homeTeam}
                    score={fixture.homeScore}
                    align="left"
                />
                <div className="flex flex-col items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    <span>VS</span>
                    <span>{live ? 'Now' : 'Fixture'}</span>
                </div>
                <TeamLine
                    crest={fixture.awayCrest}
                    name={fixture.awayTeam}
                    score={fixture.awayScore}
                    align="right"
                />
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
                            Browse the live PSL player list. Squad selection is not connected yet.
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
                            <Loader2 className="h-4 w-4 animate-spin" />
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
                    <p className="text-[11px] text-muted-foreground">South African football hub</p>
                </div>
            </div>

            <Button variant="ghost" size="icon" onClick={onAccount} aria-label="Account">
                <UserCircle2 className="h-5 w-5" />
            </Button>
        </div>
    </header>
);

const BottomNav = ({
    screen,
    onChange
}: {
    screen: Screen;
    onChange: (screen: Screen) => void;
}) => (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-[28rem] grid-cols-5 px-2 py-2">
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
                const active = screen === key;
                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => onChange(key)}
                        className={cn(
                            'flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                            active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <span
                            className={cn(
                                'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
                                active ? 'bg-primary/10' : 'bg-transparent'
                            )}
                        >
                            <Icon className="h-4.5 w-4.5" />
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

    const refreshCore = async () => {
        try {
            const [fixtureData, standingsData] = await Promise.all([fetchFixtures(), fetchStandings()]);
            setFixtures(fixtureData.fixtures);
            setStandings(standingsData.standings);
            setSeasonName(fixtureData.season?.name ?? standingsData.season?.name ?? null);
            setCoreError(null);
            toast('Match data refreshed');
        } catch (err) {
            toast.error((err as Error).message || 'Could not refresh match data');
        }
    };

    const refreshNews = async () => {
        setNewsLoading(true);
        try {
            const data = await fetchNews(10);
            setNews(data.articles);
            setNewsUnavailable(Boolean(data.unavailable));
            setNewsError(null);
            toast('News refreshed');
        } catch (err) {
            setNewsError((err as Error).message);
            toast.error((err as Error).message || 'Could not refresh news');
        } finally {
            setNewsLoading(false);
        }
    };

    const sortedFixtures = useMemo(
        () => [...fixtures].sort((a, b) => Date.parse(a.kickoff ?? '') - Date.parse(b.kickoff ?? '')),
        [fixtures]
    );

    const liveFixtures = useMemo(() => sortedFixtures.filter(isLive), [sortedFixtures]);
    const upcomingFixtures = useMemo(
        () => sortedFixtures.filter((fixture) => !isLive(fixture) && !isFinished(fixture)),
        [sortedFixtures]
    );
    const finishedFixtures = useMemo(() => sortedFixtures.filter(isFinished).reverse(), [sortedFixtures]);

    const newsCategories = useMemo(() => {
        const tags = new Set<string>();
        for (const article of news) {
            if (isNonEmptyString(article.tag)) tags.add(article.tag.trim());
        }

        const values = [...tags].sort((a, b) => a.localeCompare(b));
        return values.length ? ['All', ...values] : TAG_FALLBACKS;
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

    const renderNews = () => (
        <div className="space-y-4">
            <ShellCard className="overflow-hidden border-emerald-500/20 bg-gradient-to-br from-emerald-500/90 via-primary/90 to-emerald-700/90 text-white">
                <div className="p-4">
                    <SectionTitle
                        icon={Newspaper}
                        title="Live News"
                        subtitle="Your daily digest of South African football"
                        action={
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-8 gap-1.5 bg-white/15 text-white hover:bg-white/25"
                                    onClick={() => setScreen('live')}
                                >
                                    <Radio className="h-3.5 w-3.5" />
                                    Live
                                </Button>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-8 gap-1.5 bg-white/15 text-white hover:bg-white/25"
                                    onClick={refreshNews}
                                >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    Refresh
                                </Button>
                            </div>
                        }
                    />

                    <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
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
                    <Loader2 className="h-4 w-4 animate-spin" />
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
                title="My Squad"
                description="Squad management is not connected yet, but the player pool is live so you can start exploring current PSL options."
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
                    <Button variant="outline" className="justify-between" onClick={refreshCore}>
                        <span>Refresh fixtures and table</span>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </ShellCard>
        </div>
    );

    const renderLeagues = () => (
        <div className="space-y-4">
            <PlaceholderPanel
                title="Leagues"
                description="Private leagues and invites are not wired up yet. This screen is ready for that workflow once the backend exists."
                primary={{
                    label: 'Create league',
                    onClick: () =>
                        toast('League creation is not connected yet. Tell me what backend flow you want.')
                }}
                secondary={{
                    label: 'Join league',
                    onClick: () =>
                        toast('League joining is not connected yet. I need the invite flow or API details.')
                }}
            />

            <ShellCard className="p-4">
                <SectionTitle
                    icon={Trophy}
                    title="Suggested next step"
                    subtitle="If you want real league functionality, I need the league rules and backend endpoint."
                />
                <div className="mt-4 flex gap-2">
                    <Button className="flex-1" variant="outline" onClick={() => setScreen('table')}>
                        PSL table
                    </Button>
                    <Button className="flex-1" variant="outline" onClick={() => setScreen('news')}>
                        Go to news
                    </Button>
                </div>
            </ShellCard>
        </div>
    );

    const renderTable = () => (
        <div className="space-y-4">
            <ShellCard className="p-4">
                <SectionTitle
                    icon={ShieldHalf}
                    title="PSL Table"
                    subtitle="League standings are calculated from completed matches only."
                    action={
                        <Button size="sm" variant="outline" onClick={refreshCore} className="gap-1.5">
                            <RefreshCw className="h-3.5 w-3.5" />
                            Refresh
                        </Button>
                    }
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
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                        <Loader2 className="h-4 w-4 animate-spin" />
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
            <ShellCard className="p-4">
                <SectionTitle
                    icon={Radio}
                    title="Live Games"
                    subtitle="Tap any fixture to open the match detail view."
                    action={
                        <Button size="sm" variant="outline" onClick={refreshCore} className="gap-1.5">
                            <RefreshCw className="h-3.5 w-3.5" />
                            Refresh
                        </Button>
                    }
                />
            </ShellCard>

            {coreError && (
                <ShellCard className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                    Could not load live fixtures: {coreError}
                </ShellCard>
            )}

            {liveFixtures.length > 0 && (
                <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Live now
                    </h3>
                    <div className="space-y-3">
                        {liveFixtures.map((fixture) => (
                            <LiveFixtureCard key={fixture.id} fixture={fixture} onSelect={setSelectedFixture} />
                        ))}
                    </div>
                </section>
            )}

            <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Upcoming and recent
                </h3>

                {coreLoading && sortedFixtures.length === 0 ? (
                    <ShellCard className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading fixtures…
                    </ShellCard>
                ) : upcomingFixtures.length === 0 && finishedFixtures.length === 0 ? (
                    <ShellCard className="p-5 text-center text-sm text-muted-foreground">
                        No fixtures available right now.
                    </ShellCard>
                ) : (
                    <div className="space-y-4">
                        {[...groupByDay(upcomingFixtures), ...groupByDay(finishedFixtures)].map(([day, dayFixtures]) => (
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
                <div className="mb-4">
                    <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                        {SCREEN_LABELS[screen]}
                    </p>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight">Touchline SA</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {seasonName ? `PSL ${seasonName}` : 'South African football coverage'} · times in SAST
                    </p>
                </div>

                {currentScreen()}
            </main>

            <BottomNav screen={screen} onChange={setScreen} />
            <MatchDetail fixture={selectedFixture} onClose={() => setSelectedFixture(null)} />
            <PlayerPoolDialog open={playerPoolOpen} onOpenChange={setPlayerPoolOpen} />
        </div>
    );
};

export default FootballDashboard;
