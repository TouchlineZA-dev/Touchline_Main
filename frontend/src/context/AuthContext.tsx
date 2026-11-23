import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { LoginPayload, RegisterPayload, User } from '@/types/auth';
import {
    getCurrentUser,
    loginUser,
    logoutUser,
    registerUser,
    updateFavoriteClub,
    updateFantasyTeamName
} from '@/services/authService';
import { toast } from 'sonner';

interface AuthContextValue {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    isAuthModalOpen: boolean;
    openAuthModal: () => void;
    closeAuthModal: () => void;
    login: (payload: LoginPayload) => Promise<void>;
    register: (payload: RegisterPayload) => Promise<void>;
    logout: () => Promise<void>;
    changeFavoriteClub: (clubId: string) => Promise<void>;
    changeTeamName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    useEffect(() => {
        try {
            const activeUser = getCurrentUser();
            setUser(activeUser);
        } catch (err) {
            console.error('Failed to restore user session:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const login = async (payload: LoginPayload) => {
        setIsLoading(true);
        try {
            const loggedIn = await loginUser(payload);
            setUser(loggedIn);
            setIsAuthModalOpen(false);
            toast.success(`Welcome back, ${loggedIn.username}!`);
        } catch (err: any) {
            toast.error(err.message || 'Login failed. Please check your credentials.');
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (payload: RegisterPayload) => {
        setIsLoading(true);
        try {
            const newUser = await registerUser(payload);
            setUser(newUser);
            setIsAuthModalOpen(false);
            toast.success(`Account created! Welcome to Touchline SA, ${newUser.username}!`);
        } catch (err: any) {
            toast.error(err.message || 'Registration failed.');
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        try {
            await logoutUser();
            setUser(null);
            toast.info('You have signed out.');
        } catch (err: any) {
            toast.error(err.message || 'Failed to sign out.');
        }
    };

    const changeFavoriteClub = async (clubId: string) => {
        if (!user) return;
        try {
            const updated = await updateFavoriteClub(user.id, clubId);
            setUser(updated);
            toast.success(`Favorite club updated to ${updated.favoriteClub?.name}!`);
        } catch (err: any) {
            toast.error(err.message || 'Could not update favorite club.');
        }
    };

    const changeTeamName = async (name: string) => {
        if (!user) return;
        try {
            const updated = await updateFantasyTeamName(user.id, name);
            setUser(updated);
            toast.success(`Team name updated to "${updated.fantasyTeamName}"!`);
        } catch (err: any) {
            toast.error(err.message || 'Could not update team name.');
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: Boolean(user),
                isLoading,
                isAuthModalOpen,
                openAuthModal: () => setIsAuthModalOpen(true),
                closeAuthModal: () => setIsAuthModalOpen(false),
                login,
                register,
                logout,
                changeFavoriteClub,
                changeTeamName
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
