import { LoginPayload, RegisterPayload, User } from '@/types/auth';
import { getPslClubById } from '@/constants/pslClubs';

const CURRENT_USER_KEY = 'touchline_sa_auth_session';
const REGISTERED_USERS_KEY = 'touchline_sa_users_store';

interface StoredAccount extends User {
    passwordHash: string;
}

const getStoredAccounts = (): StoredAccount[] => {
    try {
        const raw = localStorage.getItem(REGISTERED_USERS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

const saveStoredAccounts = (accounts: StoredAccount[]) => {
    try {
        localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(accounts));
    } catch (err) {
        console.error('Failed to save accounts store', err);
    }
};

export const getCurrentUser = (): User | null => {
    try {
        const raw = localStorage.getItem(CURRENT_USER_KEY);
        if (!raw) return null;
        const user: User = JSON.parse(raw);
        user.favoriteClub = getPslClubById(user.favoriteClubId);
        return user;
    } catch {
        return null;
    }
};

export const saveSession = (user: User) => {
    try {
        user.favoriteClub = getPslClubById(user.favoriteClubId);
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } catch (err) {
        console.error('Failed to save auth session', err);
    }
};

export const clearSession = () => {
    try {
        localStorage.removeItem(CURRENT_USER_KEY);
    } catch (err) {
        console.error('Failed to clear auth session', err);
    }
};

export const registerUser = async (payload: RegisterPayload): Promise<User> => {
    // Simulate brief network latency for realistic UX
    await new Promise((r) => setTimeout(r, 450));

    const email = payload.email.trim().toLowerCase();
    const username = payload.username.trim();

    if (!email || !email.includes('@')) {
        throw new Error('Please enter a valid email address.');
    }
    if (!username || username.length < 3) {
        throw new Error('Username must be at least 3 characters.');
    }
    if (!payload.password || payload.password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
    }
    if (!payload.favoriteClubId) {
        throw new Error('Please select your favorite PSL club.');
    }

    const accounts = getStoredAccounts();
    const existing = accounts.find(
        (acc) => acc.email.toLowerCase() === email || acc.username.toLowerCase() === username.toLowerCase()
    );

    if (existing) {
        if (existing.email.toLowerCase() === email) {
            throw new Error('An account with this email already exists.');
        }
        throw new Error('This username is already taken. Please choose another.');
    }

    const newAccount: StoredAccount = {
        id: `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        email,
        username,
        fantasyTeamName: payload.fantasyTeamName?.trim() || `${username}'s XI`,
        favoriteClubId: payload.favoriteClubId,
        favoriteClub: getPslClubById(payload.favoriteClubId),
        budget: 300.0,
        totalPoints: 0,
        gameweekPoints: 0,
        createdAt: new Date().toISOString(),
        passwordHash: payload.password // In production this would be hashed via Supabase
    };

    accounts.push(newAccount);
    saveStoredAccounts(accounts);

    const { passwordHash: _, ...userWithoutPassword } = newAccount;
    saveSession(userWithoutPassword);

    return userWithoutPassword;
};

export const loginUser = async (payload: LoginPayload): Promise<User> => {
    await new Promise((r) => setTimeout(r, 400));

    const query = payload.emailOrUsername.trim().toLowerCase();
    if (!query) {
        throw new Error('Please enter your email or username.');
    }
    if (!payload.password) {
        throw new Error('Please enter your password.');
    }

    const accounts = getStoredAccounts();
    const account = accounts.find(
        (acc) => acc.email.toLowerCase() === query || acc.username.toLowerCase() === query
    );

    if (!account || account.passwordHash !== payload.password) {
        throw new Error('Invalid email/username or password.');
    }

    const { passwordHash: _, ...userWithoutPassword } = account;
    userWithoutPassword.favoriteClub = getPslClubById(userWithoutPassword.favoriteClubId);
    saveSession(userWithoutPassword);

    return userWithoutPassword;
};

export const logoutUser = async (): Promise<void> => {
    clearSession();
};

export const updateFavoriteClub = async (userId: string, clubId: string): Promise<User> => {
    const accounts = getStoredAccounts();
    const idx = accounts.findIndex((a) => a.id === userId);
    const club = getPslClubById(clubId);

    if (idx >= 0) {
        accounts[idx].favoriteClubId = clubId;
        accounts[idx].favoriteClub = club;
        saveStoredAccounts(accounts);
    }

    const current = getCurrentUser();
    if (current && current.id === userId) {
        current.favoriteClubId = clubId;
        current.favoriteClub = club;
        saveSession(current);
        return current;
    }

    throw new Error('User not found');
};

export const updateFantasyTeamName = async (userId: string, newName: string): Promise<User> => {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('Team name cannot be empty');

    const accounts = getStoredAccounts();
    const idx = accounts.findIndex((a) => a.id === userId);

    if (idx >= 0) {
        accounts[idx].fantasyTeamName = trimmed;
        saveStoredAccounts(accounts);
    }

    const current = getCurrentUser();
    if (current && current.id === userId) {
        current.fantasyTeamName = trimmed;
        saveSession(current);
        return current;
    }

    throw new Error('User not found');
};
