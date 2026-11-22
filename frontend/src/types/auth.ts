export interface PslClub {
    id: string;
    name: string;
    shortCode: string;
    crest: string;
    jersey: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    textColor: string;
}

export interface User {
    id: string;
    email: string;
    username: string;
    fantasyTeamName: string;
    favoriteClubId: string;
    favoriteClub?: PslClub;
    budget: number;
    totalPoints: number;
    gameweekPoints: number;
    createdAt: string;
}

export interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

export interface RegisterPayload {
    email: string;
    username: string;
    password: string;
    fantasyTeamName: string;
    favoriteClubId: string;
}

export interface LoginPayload {
    emailOrUsername: string;
    password: string;
}
