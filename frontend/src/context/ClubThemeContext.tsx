import { createContext, useContext, useMemo, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { PslClub } from '@/types/auth';
import { PSL_CLUBS } from '@/constants/pslClubs';

interface ClubThemeContextValue {
    club: PslClub | null;
    isCustomTheme: boolean;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    badgeStyle: React.CSSProperties;
    bannerGradient: string;
    buttonStyle: React.CSSProperties;
}

const ClubThemeContext = createContext<ClubThemeContextValue | undefined>(undefined);

export const ClubThemeProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();

    const theme = useMemo<ClubThemeContextValue>(() => {
        const club = user?.favoriteClub || null;

        if (!club) {
            return {
                club: null,
                isCustomTheme: false,
                primaryColor: '#059669', // Emerald/green default brand
                secondaryColor: '#10b981',
                accentColor: '#047857',
                badgeStyle: { backgroundColor: 'rgba(5, 150, 105, 0.1)', color: '#047857' },
                bannerGradient: 'linear-gradient(135deg, #2fbf73 0%, #0f8f4e 100%)',
                buttonStyle: { backgroundColor: '#059669', color: '#ffffff' }
            };
        }

        return {
            club,
            isCustomTheme: true,
            primaryColor: club.primaryColor,
            secondaryColor: club.secondaryColor,
            accentColor: club.accentColor,
            badgeStyle: {
                backgroundColor: `${club.primaryColor}22`,
                color: club.textColor === '#FFFFFF' ? club.primaryColor : club.textColor,
                borderColor: `${club.primaryColor}44`
            },
            bannerGradient: `linear-gradient(135deg, ${club.primaryColor} 0%, ${club.secondaryColor} 100%)`,
            buttonStyle: {
                backgroundColor: club.primaryColor,
                color: club.textColor
            }
        };
    }, [user?.favoriteClub]);

    return (
        <ClubThemeContext.Provider value={theme}>
            {children}
        </ClubThemeContext.Provider>
    );
};

export const useClubTheme = () => {
    const context = useContext(ClubThemeContext);
    if (!context) {
        throw new Error('useClubTheme must be used within a ClubThemeProvider');
    }
    return context;
};
