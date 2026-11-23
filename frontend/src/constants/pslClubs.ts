import { PslClub } from '@/types/auth';

export const PSL_CLUBS: PslClub[] = [
    {
        id: 'sundowns',
        name: 'Mamelodi Sundowns',
        shortCode: 'MSD',
        crest: '/logos/Mamelodi Sundowns logo.png',
        jersey: '/jerseys/sundowns-kit.svg',
        primaryColor: '#FFD200', // Yellow
        secondaryColor: '#0080C8', // Sky Blue
        accentColor: '#005C29', // Green
        textColor: '#003A60'
    },
    {
        id: 'pirates',
        name: 'Orlando Pirates',
        shortCode: 'PIR',
        crest: '/logos/Orland Pirates logo.png',
        jersey: '/jerseys/pirates-kit.svg',
        primaryColor: '#121212', // Black
        secondaryColor: '#D31E28', // Red
        accentColor: '#FFFFFF', // White
        textColor: '#FFFFFF'
    },
    {
        id: 'chiefs',
        name: 'Kaizer Chiefs',
        shortCode: 'KZC',
        crest: '/logos/Kaizer Chiefs logo.png',
        jersey: '/jerseys/chiefs-kit.svg',
        primaryColor: '#FDB913', // Gold
        secondaryColor: '#000000', // Black
        accentColor: '#B8860B',
        textColor: '#000000'
    },
    {
        id: 'stellenbosch',
        name: 'Stellenbosch FC',
        shortCode: 'STB',
        crest: '/logos/Stellenbosch FC logo.png',
        jersey: '/jerseys/stellenbosch-kit.svg',
        primaryColor: '#6B1D2F', // Maroon
        secondaryColor: '#D4AF37', // Gold
        accentColor: '#8B263E',
        textColor: '#FFFFFF'
    },
    {
        id: 'supersport',
        name: 'SuperSport United',
        shortCode: 'SSU',
        crest: '/jerseys/supersport.png',
        jersey: '/jerseys/supersport-kit.svg',
        primaryColor: '#003882', // Royal Blue
        secondaryColor: '#E31B23', // Red
        accentColor: '#002250',
        textColor: '#FFFFFF'
    },
    {
        id: 'capetowncity',
        name: 'Cape Town City FC',
        shortCode: 'CTC',
        crest: '/jerseys/capetowncity.png',
        jersey: '/jerseys/capetowncity-kit.svg',
        primaryColor: '#1A2849', // Dark Navy
        secondaryColor: '#E6B325', // Gold
        accentColor: '#283B6B',
        textColor: '#FFFFFF'
    },
    {
        id: 'amazulu',
        name: 'AmaZulu FC',
        shortCode: 'AMZ',
        crest: '/logos/AmaZulu FC logo.png',
        jersey: '/jerseys/amazulu-kit.svg',
        primaryColor: '#005C29', // Green
        secondaryColor: '#FFFFFF', // White
        accentColor: '#007A37',
        textColor: '#FFFFFF'
    },
    {
        id: 'chippa',
        name: 'Chippa United',
        shortCode: 'CHU',
        crest: '/logos/Chippa United logo.png',
        jersey: '/jerseys/chippa-kit.svg',
        primaryColor: '#E31B23', // Chilli Red
        secondaryColor: '#003366', // Blue
        accentColor: '#B3141A',
        textColor: '#FFFFFF'
    },
    {
        id: 'golden_arrows',
        name: 'Golden Arrows',
        shortCode: 'GDA',
        crest: '/logos/Golden Arrows logo.png',
        jersey: '/jerseys/goldenarrows-kit.svg',
        primaryColor: '#006837', // Green
        secondaryColor: '#FFD200', // Yellow
        accentColor: '#008544',
        textColor: '#FFFFFF'
    },
    {
        id: 'polokwane',
        name: 'Polokwane City',
        shortCode: 'PLK',
        crest: '/logos/Polokwane City logo.png',
        jersey: '/jerseys/polokwane-kit.svg',
        primaryColor: '#F37021', // Orange
        secondaryColor: '#1A1A1A', // Black
        accentColor: '#D45B11',
        textColor: '#FFFFFF'
    },
    {
        id: 'richards_bay',
        name: 'Richards Bay FC',
        shortCode: 'RBFC',
        crest: '/logos/Richards Bay logo.png',
        jersey: '/jerseys/richardsbay-kit.svg',
        primaryColor: '#1B4F72', // Blue
        secondaryColor: '#FFFFFF', // White
        accentColor: '#2874A6',
        textColor: '#FFFFFF'
    },
    {
        id: 'sekhukhune',
        name: 'Sekhukhune United',
        shortCode: 'SKH',
        crest: '/logos/Sekhukhune United FC logo.png',
        jersey: '/jerseys/sekhukhune-kit.svg',
        primaryColor: '#800020', // Burgundy
        secondaryColor: '#87CEEB', // Sky Blue
        accentColor: '#A51D38',
        textColor: '#FFFFFF'
    },
    {
        id: 'ts_galaxy',
        name: 'TS Galaxy',
        shortCode: 'TSG',
        crest: '/logos/TS galaxy logo.png',
        jersey: '/jerseys/tsgalaxy-kit.svg',
        primaryColor: '#B81D24', // Red
        secondaryColor: '#1A1A1A', // Black
        accentColor: '#E2262E',
        textColor: '#FFFFFF'
    },
    {
        id: 'magesi',
        name: 'Magesi FC',
        shortCode: 'MAG',
        crest: '/logos/Magesi FC logo.png',
        jersey: '/jerseys/magesi-kit.svg',
        primaryColor: '#0D47A1', // Blue
        secondaryColor: '#2E7D32', // Green
        accentColor: '#1565C0',
        textColor: '#FFFFFF'
    },
    {
        id: 'marumo',
        name: 'Marumo Gallants',
        shortCode: 'MRG',
        crest: '/logos/Marumo Gallants logo.png',
        jersey: '/jerseys/marumo-kit.svg',
        primaryColor: '#E65100', // Deep Orange
        secondaryColor: '#0D47A1', // Navy
        accentColor: '#F57C00',
        textColor: '#FFFFFF'
    },
    {
        id: 'durban_city',
        name: 'Durban City FC',
        shortCode: 'DBC',
        crest: '/logos/Durban City FC logo.png',
        jersey: '/jerseys/durbancity-kit.svg',
        primaryColor: '#0F172A', // Slate/Navy
        secondaryColor: '#EAB308', // Gold
        accentColor: '#1E293B',
        textColor: '#FFFFFF'
    }
];

export const GK_JERSEY = '/jerseys/gk-kit.svg';

export const getPslClubById = (id: string | null | undefined): PslClub => {
    if (!id) return PSL_CLUBS[0];
    const match = PSL_CLUBS.find(
        (c) => c.id.toLowerCase() === id.toLowerCase() || c.name.toLowerCase().includes(id.toLowerCase())
    );
    return match || PSL_CLUBS[0];
};

export const getClubByName = (name: string | null | undefined): PslClub | null => {
    if (!name) return null;
    const lower = name.toLowerCase().trim();
    return (
        PSL_CLUBS.find(
            (c) =>
                c.name.toLowerCase().includes(lower) ||
                lower.includes(c.name.toLowerCase()) ||
                (c.shortCode && lower.includes(c.shortCode.toLowerCase()))
        ) ?? null
    );
};

export const getJerseyForTeam = (teamName: string | null | undefined, isGoalkeeper = false): string => {
    if (isGoalkeeper) return GK_JERSEY;
    const club = getClubByName(teamName);
    return club?.jersey || '/jerseys/chiefs-kit.svg';
};
