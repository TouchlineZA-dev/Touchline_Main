import { ApiFixture, sastTime, isLive, isFinished, hasNoResult } from '@/services/touchlineApi';
import { TeamCrest } from './TeamCrest';
import { Broadcast, Clock, ICON, WarningCircle } from './icons';
import { cn } from '@/lib/utils';

interface FixtureRowProps {
    fixture: ApiFixture;
    onSelect: (fixture: ApiFixture) => void;
}

const StatusBadge = ({ fixture }: { fixture: ApiFixture }) => {
    if (isLive(fixture)) {
        return (
            <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
                <Broadcast size={14} weight="bold" className="animate-pulse" />
                LIVE
            </span>
        );
    }

    if (isFinished(fixture)) {
        return <span className="text-xs font-medium text-muted-foreground">FT</span>;
    }

    if (hasNoResult(fixture)) {
        return (
            <span
                className="flex items-center gap-1 text-xs font-medium text-amber-600"
                title={fixture.status}
            >
                <WarningCircle size={14} />
                <span className="truncate">{fixture.status}</span>
            </span>
        );
    }

    return (
        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Clock size={14} />
            {sastTime(fixture.kickoff)}
        </span>
    );
};

export const FixtureRow = ({ fixture, onSelect }: FixtureRowProps) => {
    const showScore = isFinished(fixture) || isLive(fixture);
    const live = isLive(fixture);

    return (
        <button
            type="button"
            onClick={() => onSelect(fixture)}
            className="flex w-full items-center gap-3 border-b px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
        >
            <span className="w-[4.5rem] shrink-0">
                <StatusBadge fixture={fixture} />
            </span>

            <span className="min-w-0 flex-1 space-y-1.5">
                <span className="flex items-center gap-2">
                    <TeamCrest crest={fixture.homeCrest} name={fixture.homeTeam} size={20} />
                    <span className="truncate text-sm">{fixture.homeTeam}</span>
                </span>
                <span className="flex items-center gap-2">
                    <TeamCrest crest={fixture.awayCrest} name={fixture.awayTeam} size={20} />
                    <span className="truncate text-sm">{fixture.awayTeam}</span>
                </span>
            </span>

            {showScore && (
                <span
                    className={cn(
                        'shrink-0 space-y-1.5 text-right text-sm font-semibold tabular-nums',
                        live && 'text-red-600'
                    )}
                >
                    <span className="block">{fixture.homeScore ?? '-'}</span>
                    <span className="block">{fixture.awayScore ?? '-'}</span>
                </span>
            )}
        </button>
    );
};
