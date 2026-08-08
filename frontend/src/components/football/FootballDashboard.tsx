import { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    ApiFixture,
    ApiStanding,
    fetchFixtures,
    fetchStandings,
    isFinished,
    isLive,
    sastDate,
    sastDayKey
} from '@/services/touchlineApi';
import { FixtureRow } from './FixtureRow';
import { StandingsTable } from './StandingsTable';
import { MatchDetail } from './MatchDetail';
import { NewsList } from './NewsList';

/** Live scores move; poll while the tab is open. */
const REFRESH_MS = 60_000;

const groupByDay = (fixtures: ApiFixture[]) => {
    const groups = new Map<string, ApiFixture[]>();

    for (const fixture of fixtures) {
        const key = sastDayKey(fixture.kickoff);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(fixture);
    }

    return [...groups.entries()];
};

const FixtureList = ({
    fixtures,
    emptyMessage,
    onSelect
}: {
    fixtures: ApiFixture[];
    emptyMessage: string;
    onSelect: (fixture: ApiFixture) => void;
}) => {
    if (!fixtures.length) {
        return <p className="py-10 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
    }

    return (
        <div className="space-y-5">
            {groupByDay(fixtures).map(([day, dayFixtures]) => (
                <section key={day}>
                    <h3 className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {sastDate(dayFixtures[0].kickoff)}
                    </h3>
                    <div className="rounded-lg border">
                        {dayFixtures.map((fixture) => (
                            <FixtureRow key={fixture.id} fixture={fixture} onSelect={onSelect} />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
};

export const FootballDashboard = () => {
    const [fixtures, setFixtures] = useState<ApiFixture[]>([]);
    const [standings, setStandings] = useState<ApiStanding[]>([]);
    const [seasonName, setSeasonName] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<ApiFixture | null>(null);

    useEffect(() => {
        let cancelled = false;

        const load = async (isInitial: boolean) => {
            try {
                const [fixtureData, standingsData] = await Promise.all([
                    fetchFixtures(),
                    fetchStandings()
                ]);

                if (cancelled) return;

                setFixtures(fixtureData.fixtures);
                setStandings(standingsData.standings);
                setSeasonName(fixtureData.season?.name ?? null);
                setError(null);
            } catch (err) {
                // A failed refresh keeps the last good data on screen.
                if (!cancelled && isInitial) setError((err as Error).message);
            } finally {
                if (!cancelled && isInitial) setLoading(false);
            }
        };

        load(true);
        const timer = setInterval(() => load(false), REFRESH_MS);

        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, []);

    const { live, upcoming, results } = useMemo(() => {
        const sorted = [...fixtures].sort(
            (a, b) => Date.parse(a.kickoff ?? '') - Date.parse(b.kickoff ?? '')
        );

        return {
            live: sorted.filter(isLive),
            upcoming: sorted.filter((f) => !isLive(f) && !isFinished(f)),
            // Most recent result first.
            results: sorted.filter(isFinished).reverse()
        };
    }, [fixtures]);

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b">
                <div className="mx-auto flex max-w-3xl items-baseline justify-between px-4 py-4">
                    <h1 className="text-lg font-semibold">Touchline</h1>
                    <p className="text-xs text-muted-foreground">
                        PSL{seasonName ? ` · ${seasonName}` : ''} · times in SAST
                    </p>
                </div>
            </header>

            <main className="mx-auto max-w-3xl px-4 py-5">
                {loading && (
                    <p className="py-16 text-center text-sm text-muted-foreground">
                        Loading matches…
                    </p>
                )}

                {error && !loading && (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
                        <p className="font-medium text-destructive">Could not load match data</p>
                        <p className="mt-1 text-muted-foreground">{error}</p>
                    </div>
                )}

                {!loading && !error && (
                    <>
                        {live.length > 0 && (
                            <section className="mb-6">
                                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />
                                    Live now
                                </h2>
                                <div className="rounded-lg border border-red-200">
                                    {live.map((fixture) => (
                                        <FixtureRow
                                            key={fixture.id}
                                            fixture={fixture}
                                            onSelect={setSelected}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        <Tabs defaultValue="fixtures">
                            <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="fixtures">Fixtures</TabsTrigger>
                                <TabsTrigger value="results">Results</TabsTrigger>
                                <TabsTrigger value="table">Table</TabsTrigger>
                                <TabsTrigger value="news">News</TabsTrigger>
                            </TabsList>

                            <TabsContent value="fixtures" className="mt-4">
                                <FixtureList
                                    fixtures={upcoming}
                                    emptyMessage="No upcoming fixtures scheduled."
                                    onSelect={setSelected}
                                />
                            </TabsContent>

                            <TabsContent value="results" className="mt-4">
                                <FixtureList
                                    fixtures={results}
                                    emptyMessage="No completed matches yet."
                                    onSelect={setSelected}
                                />
                            </TabsContent>

                            <TabsContent value="table" className="mt-4">
                                <StandingsTable standings={standings} />
                                <p className="mt-3 text-xs text-muted-foreground">
                                    Table calculated from completed matches only.
                                </p>
                            </TabsContent>

                            <TabsContent value="news" className="mt-4">
                                <NewsList />
                            </TabsContent>
                        </Tabs>
                    </>
                )}
            </main>

            <MatchDetail fixture={selected} onClose={() => setSelected(null)} />
        </div>
    );
};

export default FootballDashboard;
