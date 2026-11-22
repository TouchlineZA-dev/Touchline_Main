import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useClubTheme } from '@/context/ClubThemeContext';
import { ApiFixture, ApiStanding, isFinished, isLive, sastDate, sastTime } from '@/services/touchlineApi';
import { TeamCrest } from './TeamCrest';
import { Button } from '@/components/ui/button';
import { ArrowRight, Calendar, Shield, Trophy } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface MyClubHubProps {
    fixtures: ApiFixture[];
    standings: ApiStanding[];
    onSelectFixture: (fixture: ApiFixture) => void;
}

export const MyClubHub = ({ fixtures, standings, onSelectFixture }: MyClubHubProps) => {
    const { user, isAuthenticated, openAuthModal } = useAuth();
    const { club } = useClubTheme();

    const clubName = club?.name || user?.favoriteClub?.name;

    // Find club's standing in table
    const clubStanding = useMemo(() => {
        if (!clubName) return null;
        const lower = clubName.toLowerCase();
        return standings.find(
            (s) => s.team.toLowerCase().includes(lower) || lower.includes(s.team.toLowerCase())
        );
    }, [standings, clubName]);

    // Find club's next upcoming or live fixture
    const clubNextFixture = useMemo(() => {
        if (!clubName) return null;
        const lower = clubName.toLowerCase();

        // 1. Check if club is currently in a live fixture
        const activeLive = fixtures.find(
            (f) =>
                isLive(f) &&
                (f.homeTeam.toLowerCase().includes(lower) || f.awayTeam.toLowerCase().includes(lower))
        );
        if (activeLive) return activeLive;

        // 2. Next scheduled fixture
        const scheduled = fixtures.filter(
            (f) =>
                !isFinished(f) &&
                (f.homeTeam.toLowerCase().includes(lower) || f.awayTeam.toLowerCase().includes(lower))
        );
        if (scheduled.length > 0) return scheduled[0];

        // 3. Fallback: most recent match
        const finished = fixtures
            .filter(
                (f) =>
                    isFinished(f) &&
                    (f.homeTeam.toLowerCase().includes(lower) || f.awayTeam.toLowerCase().includes(lower))
            )
            .reverse();
        return finished[0] || null;
    }, [fixtures, clubName]);

    if (!isAuthenticated || !club) {
        return (
            <div className="rounded-3xl border border-emerald-600/20 bg-gradient-to-br from-emerald-500/10 via-background to-emerald-500/5 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Shield size={22} weight="fill" />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                                Personalize Touchline
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                Support a PSL team? Pick your club for tailored live scores & news.
                            </p>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        onClick={openAuthModal}
                        className="rounded-full text-xs font-semibold shrink-0"
                    >
                        Choose Club
                    </Button>
                </div>
            </div>
        );
    }

    const liveMatch = clubNextFixture ? isLive(clubNextFixture) : false;
    const isHome = clubNextFixture?.homeTeam.toLowerCase().includes(clubName.toLowerCase());
    const opponentName = isHome ? clubNextFixture?.awayTeam : clubNextFixture?.homeTeam;
    const opponentCrest = isHome ? clubNextFixture?.awayCrest : clubNextFixture?.homeCrest;

    return (
        <div
            className="relative overflow-hidden rounded-3xl border border-white/20 p-4 shadow-md transition-all"
            style={{
                background: `linear-gradient(135deg, ${club.primaryColor} 0%, ${club.secondaryColor} 100%)`,
                color: club.textColor
            }}
        >
            {/* Subtle background crest watermark */}
            <div className="pointer-events-none absolute -right-6 -bottom-6 opacity-15">
                <TeamCrest crest={club.crest} name={club.name} size={130} />
            </div>

            {/* Header row */}
            <div className="relative flex items-center justify-between gap-2 border-b border-white/20 pb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/90 p-1 shadow-sm">
                        <TeamCrest crest={club.crest} name={club.name} size={30} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/25">
                                My Club Hub
                            </span>
                            {liveMatch && (
                                <span className="flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-white animate-pulse">
                                    Live Now
                                </span>
                            )}
                        </div>
                        <h2 className="text-sm font-bold truncate leading-snug mt-0.5">{club.name}</h2>
                    </div>
                </div>

                {clubStanding && (
                    <div className="flex flex-col items-end shrink-0">
                        <div className="flex items-center gap-1 text-[11px] font-bold">
                            <Trophy size={14} />
                            <span>#{clubStanding.position} on Table</span>
                        </div>
                        <span className="text-[10px] opacity-80">{clubStanding.points} pts · {clubStanding.played} played</span>
                    </div>
                )}
            </div>

            {/* Next Match / Current Game Card */}
            {clubNextFixture ? (
                <button
                    type="button"
                    onClick={() => onSelectFixture(clubNextFixture)}
                    className="relative mt-3 w-full rounded-2xl bg-black/20 hover:bg-black/30 backdrop-blur-sm p-3 text-left transition-colors flex items-center justify-between gap-3"
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/95 p-1 shadow">
                            <TeamCrest crest={opponentCrest} name={opponentName} size={24} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] uppercase font-bold tracking-wider opacity-75">
                                {liveMatch ? 'Live Score' : isFinished(clubNextFixture) ? 'Recent Result' : 'Next Fixture'}
                            </p>
                            <p className="text-xs font-bold truncate">
                                {isHome ? 'vs' : '@'} {opponentName}
                            </p>
                            <div className="flex items-center gap-1.5 text-[11px] opacity-85 mt-0.5">
                                <Calendar size={12} />
                                <span>
                                    {liveMatch
                                        ? `${clubNextFixture.homeScore ?? 0} - ${clubNextFixture.awayScore ?? 0}`
                                        : clubNextFixture.kickoff
                                          ? `${sastDate(clubNextFixture.kickoff)} · ${sastTime(clubNextFixture.kickoff)}`
                                          : 'Schedule TBD'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 text-xs font-semibold opacity-90">
                        <span>Details</span>
                        <ArrowRight size={14} />
                    </div>
                </button>
            ) : (
                <p className="relative mt-3 text-xs opacity-80">
                    No upcoming fixtures scheduled right now for {club.name}.
                </p>
            )}
        </div>
    );
};
