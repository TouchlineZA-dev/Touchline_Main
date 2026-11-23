import { useMemo } from 'react';
import { getPslClubById, getClubByName, PSL_CLUBS } from '@/constants/pslClubs';
import { PslClub } from '@/types/auth';

export interface TeamJerseyProps {
    clubId?: string | null;
    clubName?: string | null;
    isGoalkeeper?: boolean;
    number?: number | string | null;
    size?: number;
    className?: string;
    showShadow?: boolean;
}

interface KitPattern {
    type: 'plain' | 'stripes' | 'sash' | 'sleeves' | 'hoops';
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    collarColor: string;
    sleeveColor: string;
    numberColor: string;
}

const CLUB_KIT_PATTERNS: Record<string, KitPattern> = {
    chiefs: {
        type: 'stripes',
        primaryColor: '#FDB913', // Gold
        secondaryColor: '#000000', // Black
        accentColor: '#000000',
        collarColor: '#000000',
        sleeveColor: '#FDB913',
        numberColor: '#000000'
    },
    pirates: {
        type: 'plain',
        primaryColor: '#121212', // Black
        secondaryColor: '#FFFFFF', // White stripes
        accentColor: '#D31E28', // Red trim
        collarColor: '#FFFFFF',
        sleeveColor: '#121212',
        numberColor: '#FFFFFF'
    },
    sundowns: {
        type: 'plain',
        primaryColor: '#FFD200', // Yellow
        secondaryColor: '#0080C8', // Sky Blue
        accentColor: '#005C29', // Green
        collarColor: '#0080C8',
        sleeveColor: '#FFD200',
        numberColor: '#003A60'
    },
    stellenbosch: {
        type: 'sleeves',
        primaryColor: '#6B1D2F', // Maroon
        secondaryColor: '#D4AF37', // Gold
        accentColor: '#D4AF37',
        collarColor: '#D4AF37',
        sleeveColor: '#D4AF37',
        numberColor: '#FFFFFF'
    },
    supersport: {
        type: 'sleeves',
        primaryColor: '#003882', // Royal Blue
        secondaryColor: '#FFFFFF', // White
        accentColor: '#E31B23', // Red
        collarColor: '#FFFFFF',
        sleeveColor: '#FFFFFF',
        numberColor: '#FFFFFF'
    },
    capetowncity: {
        type: 'sash',
        primaryColor: '#1A2849', // Navy Blue
        secondaryColor: '#E6B325', // Gold
        accentColor: '#E6B325',
        collarColor: '#E6B325',
        sleeveColor: '#1A2849',
        numberColor: '#FFFFFF'
    },
    amazulu: {
        type: 'plain',
        primaryColor: '#005C29', // Forest Green
        secondaryColor: '#FFFFFF', // White
        accentColor: '#FFFFFF',
        collarColor: '#FFFFFF',
        sleeveColor: '#005C29',
        numberColor: '#FFFFFF'
    },
    chippa: {
        type: 'sleeves',
        primaryColor: '#E31B23', // Chilli Red
        secondaryColor: '#003366', // Blue
        accentColor: '#003366',
        collarColor: '#003366',
        sleeveColor: '#003366',
        numberColor: '#FFFFFF'
    },
    golden_arrows: {
        type: 'stripes',
        primaryColor: '#006837', // Green
        secondaryColor: '#FFD200', // Yellow
        accentColor: '#FFD200',
        collarColor: '#FFD200',
        sleeveColor: '#006837',
        numberColor: '#FFFFFF'
    },
    polokwane: {
        type: 'plain',
        primaryColor: '#F37021', // Orange
        secondaryColor: '#1A1A1A', // Black
        accentColor: '#1A1A1A',
        collarColor: '#1A1A1A',
        sleeveColor: '#F37021',
        numberColor: '#FFFFFF'
    },
    richards_bay: {
        type: 'plain',
        primaryColor: '#1B4F72', // Blue
        secondaryColor: '#FFFFFF', // White
        accentColor: '#FFFFFF',
        collarColor: '#FFFFFF',
        sleeveColor: '#1B4F72',
        numberColor: '#FFFFFF'
    },
    sekhukhune: {
        type: 'sleeves',
        primaryColor: '#800020', // Burgundy
        secondaryColor: '#87CEEB', // Sky Blue
        accentColor: '#87CEEB',
        collarColor: '#87CEEB',
        sleeveColor: '#87CEEB',
        numberColor: '#FFFFFF'
    },
    ts_galaxy: {
        type: 'stripes',
        primaryColor: '#B81D24', // Red
        secondaryColor: '#1A1A1A', // Black
        accentColor: '#1A1A1A',
        collarColor: '#1A1A1A',
        sleeveColor: '#1A1A1A',
        numberColor: '#FFFFFF'
    },
    magesi: {
        type: 'plain',
        primaryColor: '#0D47A1', // Blue
        secondaryColor: '#2E7D32', // Green
        accentColor: '#2E7D32',
        collarColor: '#2E7D32',
        sleeveColor: '#0D47A1',
        numberColor: '#FFFFFF'
    },
    marumo: {
        type: 'plain',
        primaryColor: '#E65100', // Orange
        secondaryColor: '#0D47A1', // Navy
        accentColor: '#0D47A1',
        collarColor: '#0D47A1',
        sleeveColor: '#E65100',
        numberColor: '#FFFFFF'
    },
    durban_city: {
        type: 'stripes',
        primaryColor: '#0F172A', // Slate/Navy
        secondaryColor: '#EAB308', // Gold
        accentColor: '#EAB308',
        collarColor: '#EAB308',
        sleeveColor: '#0F172A',
        numberColor: '#FFFFFF'
    }
};

const GK_PATTERN: KitPattern = {
    type: 'plain',
    primaryColor: '#10B981', // Neon Emerald
    secondaryColor: '#064E3B', // Dark Green
    accentColor: '#000000',
    collarColor: '#064E3B',
    sleeveColor: '#10B981',
    numberColor: '#000000'
};

/**
 * TeamJersey: Render an authentic, scaleable 2D kit for any PSL club.
 */
export const TeamJersey = ({
    clubId,
    clubName,
    isGoalkeeper = false,
    number,
    size = 48,
    className = '',
    showShadow = true
}: TeamJerseyProps) => {
    const pattern = useMemo<KitPattern>(() => {
        if (isGoalkeeper) return GK_PATTERN;

        let club: PslClub | null = null;
        if (clubId) {
            club = getPslClubById(clubId);
        } else if (clubName) {
            club = getClubByName(clubName);
        }

        if (club && CLUB_KIT_PATTERNS[club.id]) {
            return CLUB_KIT_PATTERNS[club.id];
        }

        // Generic fallback using club primary color
        if (club) {
            return {
                type: 'plain',
                primaryColor: club.primaryColor,
                secondaryColor: club.secondaryColor,
                accentColor: club.accentColor,
                collarColor: club.secondaryColor,
                sleeveColor: club.primaryColor,
                numberColor: club.textColor
            };
        }

        return CLUB_KIT_PATTERNS.chiefs;
    }, [clubId, clubName, isGoalkeeper]);

    // Dimensions based on standard football jersey silhouette (viewBox: 0 0 100 100)
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            className={className}
            style={{
                filter: showShadow ? 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.35))' : 'none',
                overflow: 'visible'
            }}
            aria-hidden="true"
        >
            <defs>
                {/* Subtle shirt fabric crease gradient */}
                <linearGradient id={`crease-${pattern.primaryColor}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#000" stopOpacity="0.12" />
                    <stop offset="25%" stopColor="#fff" stopOpacity="0.08" />
                    <stop offset="50%" stopColor="#000" stopOpacity="0" />
                    <stop offset="75%" stopColor="#fff" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#000" stopOpacity="0.12" />
                </linearGradient>

                {/* Stripes pattern if needed */}
                <pattern
                    id={`stripes-${pattern.primaryColor}-${pattern.secondaryColor}`}
                    width="20"
                    height="100"
                    patternUnits="userSpaceOnUse"
                >
                    <rect x="0" y="0" width="10" height="100" fill={pattern.primaryColor} />
                    <rect x="10" y="0" width="10" height="100" fill={pattern.secondaryColor} />
                </pattern>

                <clipPath id="body-clip">
                    {/* Torso outline */}
                    <path d="M 28 20 L 72 20 L 76 86 L 24 86 Z" />
                </clipPath>
            </defs>

            {/* Left Sleeve */}
            <path
                d="M 28 20 L 10 38 L 22 52 L 28 40 Z"
                fill={pattern.sleeveColor}
                stroke="#000"
                strokeWidth="1.2"
                strokeOpacity="0.25"
            />
            {/* Left Sleeve Cuff Trim */}
            <path
                d="M 10 38 L 22 52"
                stroke={pattern.accentColor}
                strokeWidth="2.5"
                strokeLinecap="round"
            />

            {/* Right Sleeve */}
            <path
                d="M 72 20 L 90 38 L 78 52 L 72 40 Z"
                fill={pattern.sleeveColor}
                stroke="#000"
                strokeWidth="1.2"
                strokeOpacity="0.25"
            />
            {/* Right Sleeve Cuff Trim */}
            <path
                d="M 90 38 L 78 52"
                stroke={pattern.accentColor}
                strokeWidth="2.5"
                strokeLinecap="round"
            />

            {/* Main Torso Body */}
            <path
                d="M 28 20 Q 50 25 72 20 L 76 86 Q 50 89 24 86 Z"
                fill={
                    pattern.type === 'stripes'
                        ? `url(#stripes-${pattern.primaryColor}-${pattern.secondaryColor})`
                        : pattern.primaryColor
                }
                stroke="#000"
                strokeWidth="1.2"
                strokeOpacity="0.25"
            />

            {/* Sash pattern (e.g. Cape Town City) */}
            {pattern.type === 'sash' && (
                <path
                    d="M 26 22 L 72 84 L 76 86 L 76 72 L 34 20 Z"
                    fill={pattern.secondaryColor}
                    clipPath="url(#body-clip)"
                />
            )}

            {/* Fabric depth lighting overlay */}
            <path
                d="M 28 20 Q 50 25 72 20 L 76 86 Q 50 89 24 86 Z"
                fill={`url(#crease-${pattern.primaryColor})`}
            />

            {/* V-Neck Collar */}
            <path
                d="M 38 20 Q 50 36 62 20 Q 50 26 38 20 Z"
                fill={pattern.collarColor}
                stroke="#000"
                strokeWidth="0.8"
                strokeOpacity="0.2"
            />

            {/* Chest Badge / Accent Dot */}
            <circle cx="37" cy="38" r="3.2" fill={pattern.secondaryColor} opacity="0.9" />

            {/* Jersey Number */}
            {number !== undefined && number !== null && (
                <text
                    x="50"
                    y="63"
                    textAnchor="middle"
                    fill={pattern.numberColor}
                    fontSize="22"
                    fontWeight="900"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    style={{
                        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))'
                    }}
                >
                    {number}
                </text>
            )}
        </svg>
    );
};
