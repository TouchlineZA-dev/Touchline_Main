import React, { useEffect, useState } from 'react';
import { ApiFixture, ApiFixtureScorer, isLive } from '@/services/touchlineApi';
import { cn } from '@/lib/utils';

export interface LiveTimerInfo {
    label: string;
    minute: number | null;
    extraMinute?: number | null;
    period: 'PRE' | '1H' | 'HT' | '2H' | 'FT';
    periodLabel: string;
    clock: string;
    elapsedSeconds: number;
}

export const calculateLiveMatchTime = (
    kickoff: string | null,
    stateId?: number | null,
    scorers?: ApiFixtureScorer[]
): LiveTimerInfo => {
    if (!kickoff) {
        return {
            label: 'LIVE',
            minute: null,
            period: '1H',
            periodLabel: 'Live',
            clock: '00:00',
            elapsedSeconds: 0
        };
    }

    const start = Date.parse(kickoff);
    if (isNaN(start)) {
        return {
            label: 'LIVE',
            minute: null,
            period: '1H',
            periodLabel: 'Live',
            clock: '00:00',
            elapsedSeconds: 0
        };
    }

    const now = Date.now();
    const elapsedTotalSec = Math.max(0, Math.floor((now - start) / 1000));
    const elapsedTotalMin = Math.floor(elapsedTotalSec / 60);

    // Explicit Half-Time states in Sportmonks (3 = Half Time, 21 = Break Time)
    if (stateId === 3 || stateId === 21) {
        return {
            label: 'HT',
            minute: 45,
            period: 'HT',
            periodLabel: 'Half Time',
            clock: '45:00',
            elapsedSeconds: 45 * 60
        };
    }

    // 1st Half: 0 - 45 mins
    if (elapsedTotalMin < 45) {
        const minute = elapsedTotalMin + 1;
        const clockMin = elapsedTotalMin;
        const clockSec = elapsedTotalSec % 60;
        const clockStr = `${String(clockMin).padStart(2, '0')}:${String(clockSec).padStart(2, '0')}`;
        return {
            label: `${minute}'`,
            minute,
            period: '1H',
            periodLabel: '1st Half',
            clock: clockStr,
            elapsedSeconds: elapsedTotalSec
        };
    }

    // 1st Half Stoppage Time: 45 - 49 mins
    if (elapsedTotalMin >= 45 && elapsedTotalMin < 50 && stateId !== 22 && stateId !== 4) {
        const stoppage = elapsedTotalMin - 45 + 1;
        return {
            label: `45+${stoppage}'`,
            minute: 45,
            extraMinute: stoppage,
            period: '1H',
            periodLabel: `1st Half (+${stoppage}')`,
            clock: '45:00',
            elapsedSeconds: elapsedTotalSec
        };
    }

    // Half Time interval (~15 mins between 50 and 65 mins)
    if (elapsedTotalMin >= 50 && elapsedTotalMin < 65 && stateId !== 22 && stateId !== 4) {
        return {
            label: 'HT',
            minute: 45,
            period: 'HT',
            periodLabel: 'Half Time',
            clock: 'HT',
            elapsedSeconds: elapsedTotalSec
        };
    }

    // 2nd Half (starts ~65 mins after kickoff, or if stateId indicates 2nd half)
    const secondHalfStartMin = (stateId === 22 || stateId === 4) && elapsedTotalMin < 65 ? elapsedTotalMin : 65;
    const secondHalfSec = Math.max(0, elapsedTotalSec - (secondHalfStartMin * 60));
    const secondHalfMin = Math.floor(secondHalfSec / 60);
    let matchMinute = 45 + secondHalfMin + 1;

    // Check if scorer minutes indicate we are further along
    if (scorers && scorers.length > 0) {
        const maxGoalMin = Math.max(
            ...scorers.map((s) => s.minute ?? 0).filter((m) => m > 0 && m <= 120),
            0
        );
        if (maxGoalMin > matchMinute && maxGoalMin <= 90) {
            matchMinute = maxGoalMin;
        }
    }

    if (matchMinute <= 90) {
        const clockMin = matchMinute - 1;
        const clockSec = secondHalfSec % 60;
        const clockStr = `${String(clockMin).padStart(2, '0')}:${String(clockSec).padStart(2, '0')}`;
        return {
            label: `${matchMinute}'`,
            minute: matchMinute,
            period: '2H',
            periodLabel: '2nd Half',
            clock: clockStr,
            elapsedSeconds: elapsedTotalSec
        };
    }

    // 2nd Half Stoppage Time: 90+
    const stoppage = matchMinute - 90;
    return {
        label: `90+${stoppage}'`,
        minute: 90,
        extraMinute: stoppage,
        period: '2H',
        periodLabel: `2nd Half (+${stoppage}')`,
        clock: '90:00',
        elapsedSeconds: elapsedTotalSec
    };
};

export const useLiveMatchTimer = (
    kickoff: string | null,
    stateId?: number | null,
    scorers?: ApiFixtureScorer[]
): LiveTimerInfo => {
    const [info, setInfo] = useState<LiveTimerInfo>(() =>
        calculateLiveMatchTime(kickoff, stateId, scorers)
    );

    useEffect(() => {
        const tick = () => {
            setInfo(calculateLiveMatchTime(kickoff, stateId, scorers));
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [kickoff, stateId, scorers]);

    return info;
};

interface LiveTimerBadgeProps {
    fixture: ApiFixture;
    className?: string;
    showClock?: boolean;
}

export const LiveTimerBadge: React.FC<LiveTimerBadgeProps> = ({
    fixture,
    className,
    showClock = false
}) => {
    const timer = useLiveMatchTimer(fixture.kickoff, fixture.stateId, fixture.scorers);

    if (!isLive(fixture)) return null;

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700',
                className
            )}
        >
            <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
            </span>
            <span>LIVE</span>
            <span className="tabular-nums font-black">{timer.label}</span>
            {showClock && timer.period !== 'HT' && (
                <span className="text-[9px] font-medium text-emerald-600/80">({timer.clock})</span>
            )}
        </span>
    );
};
