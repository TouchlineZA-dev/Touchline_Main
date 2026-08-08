import { useState } from 'react';

interface TeamCrestProps {
    crest?: string | null;
    name?: string | null;
    size?: number;
}

/**
 * Team crest with a lettered fallback.
 *
 * Sportmonks serves placeholder URLs for teams it has no badge for, and the API
 * already nulls those out — but a real URL can still 404, so this also falls
 * back on image error.
 */
export const TeamCrest = ({ crest, name, size = 28 }: TeamCrestProps) => {
    const [failed, setFailed] = useState(false);
    const label = (name || '?').trim();
    const initials = label
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word[0])
        .join('')
        .toUpperCase();

    if (!crest || failed) {
        return (
            <span
                className="inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground"
                style={{ width: size, height: size, fontSize: size * 0.38 }}
                aria-hidden="true"
            >
                {initials || '?'}
            </span>
        );
    }

    return (
        <img
            src={crest}
            alt=""
            width={size}
            height={size}
            loading="lazy"
            onError={() => setFailed(true)}
            className="shrink-0 object-contain"
            style={{ width: size, height: size }}
        />
    );
};
