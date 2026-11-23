import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { PSL_CLUBS } from '@/constants/pslClubs';
import { TeamCrest } from './TeamCrest';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, UserCircle, CheckCircle, Trophy, SignOut, CircleNotch, Eye, EyeSlash } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export const AuthModal = () => {
    const {
        user,
        isAuthenticated,
        isAuthModalOpen,
        closeAuthModal,
        login,
        register,
        logout,
        changeFavoriteClub,
        changeTeamName
    } = useAuth();

    const [tab, setTab] = useState<'login' | 'register'>('register');
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [fantasyTeamName, setFantasyTeamName] = useState('');
    const [selectedClubId, setSelectedClubId] = useState('chiefs');
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Profile editing states
    const [isEditingTeamName, setIsEditingTeamName] = useState(false);
    const [newTeamName, setNewTeamName] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSubmitting(true);
        try {
            await login({ emailOrUsername: email || username, password });
            setEmail('');
            setPassword('');
        } catch (err: any) {
            setErrorMsg(err.message || 'Login failed.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSubmitting(true);
        try {
            await register({
                email,
                username,
                password,
                fantasyTeamName: fantasyTeamName || `${username}'s XI`,
                favoriteClubId: selectedClubId
            });
            setEmail('');
            setUsername('');
            setPassword('');
            setFantasyTeamName('');
        } catch (err: any) {
            setErrorMsg(err.message || 'Registration failed.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveTeamName = async () => {
        if (!newTeamName.trim()) return;
        await changeTeamName(newTeamName.trim());
        setIsEditingTeamName(false);
    };

    return (
        <Dialog open={isAuthModalOpen} onOpenChange={(open) => !open && closeAuthModal()}>
            <DialogContent className="max-h-[92vh] w-[min(94vw,34rem)] overflow-y-auto p-0 rounded-3xl">
                {isAuthenticated && user ? (
                    /* Authenticated Profile View */
                    <div className="space-y-5 p-6">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-lg">
                                <UserCircle size={24} className="text-emerald-600" />
                                <span>Manager Profile</span>
                            </DialogTitle>
                            <DialogDescription>
                                Manage your fantasy team and supported club.
                            </DialogDescription>
                        </DialogHeader>

                        {/* User Card */}
                        <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-emerald-500/10 via-background to-background p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                                        {user.favoriteClub ? (
                                            <TeamCrest
                                                crest={user.favoriteClub.crest}
                                                name={user.favoriteClub.name}
                                                size={34}
                                            />
                                        ) : (
                                            <UserCircle size={32} className="text-primary" />
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-base leading-tight">{user.username}</h3>
                                        <p className="text-xs text-muted-foreground">{user.email}</p>
                                    </div>
                                </div>
                                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-800">
                                    Active Manager
                                </span>
                            </div>

                            {/* Team Name row */}
                            <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                                        Fantasy Team Name
                                    </span>
                                    {isEditingTeamName ? (
                                        <div className="mt-1 flex gap-2">
                                            <Input
                                                value={newTeamName}
                                                onChange={(e) => setNewTeamName(e.target.value)}
                                                className="h-8 text-xs"
                                                placeholder={user.fantasyTeamName}
                                            />
                                            <Button size="sm" className="h-8 text-xs" onClick={handleSaveTeamName}>
                                                Save
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 text-xs"
                                                onClick={() => setIsEditingTeamName(false)}
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    ) : (
                                        <p className="text-sm font-semibold truncate text-foreground">
                                            {user.fantasyTeamName}
                                        </p>
                                    )}
                                </div>
                                {!isEditingTeamName && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-[11px]"
                                        onClick={() => {
                                            setNewTeamName(user.fantasyTeamName);
                                            setIsEditingTeamName(true);
                                        }}
                                    >
                                        Edit
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Supported Club Selector */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <Shield size={14} className="text-primary" />
                                    <span>Supported PSL Club</span>
                                </label>
                                <span className="text-[11px] text-muted-foreground">Tap to switch club</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1 border rounded-2xl bg-muted/20">
                                {PSL_CLUBS.map((club) => {
                                    const isSelected = user.favoriteClubId === club.id;
                                    return (
                                        <button
                                            key={club.id}
                                            type="button"
                                            onClick={() => changeFavoriteClub(club.id)}
                                            className={cn(
                                                'relative flex flex-col items-center gap-1 rounded-xl p-2 text-center transition-all',
                                                isSelected
                                                    ? 'bg-white shadow-md ring-2 ring-primary'
                                                    : 'hover:bg-background/80 opacity-70 hover:opacity-100'
                                            )}
                                        >
                                            <TeamCrest crest={club.crest} name={club.name} size={28} />
                                            <span className="text-[10px] font-semibold truncate w-full">
                                                {club.shortCode || club.name}
                                            </span>
                                            {isSelected && (
                                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white">
                                                    <CheckCircle size={12} weight="fill" />
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2 border-t">
                            <Button
                                variant="destructive"
                                className="w-full flex items-center justify-center gap-2"
                                onClick={() => {
                                    logout();
                                    closeAuthModal();
                                }}
                            >
                                <SignOut size={16} />
                                <span>Sign Out</span>
                            </Button>
                        </div>
                    </div>
                ) : (
                    /* Guest View: Tabs for Sign In or Register */
                    <div className="p-6 space-y-4">
                        <DialogHeader>
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <Trophy size={28} weight="fill" />
                            </div>
                            <DialogTitle className="text-center text-lg font-bold">
                                {tab === 'register' ? 'Join Touchline SA' : 'Welcome Back'}
                            </DialogTitle>
                            <DialogDescription className="text-center text-xs">
                                {tab === 'register'
                                    ? 'Pick your club, name your team, and play PSL Fantasy.'
                                    : 'Sign in to access your squad, stats, and leagues.'}
                            </DialogDescription>
                        </DialogHeader>

                        {/* Tab Switcher */}
                        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-xs font-semibold">
                            <button
                                type="button"
                                onClick={() => {
                                    setTab('register');
                                    setErrorMsg(null);
                                }}
                                className={cn(
                                    'rounded-lg py-1.5 transition-colors',
                                    tab === 'register' ? 'bg-background shadow font-bold text-foreground' : 'text-muted-foreground'
                                )}
                            >
                                Create Account
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setTab('login');
                                    setErrorMsg(null);
                                }}
                                className={cn(
                                    'rounded-lg py-1.5 transition-colors',
                                    tab === 'login' ? 'bg-background shadow font-bold text-foreground' : 'text-muted-foreground'
                                )}
                            >
                                Sign In
                            </button>
                        </div>

                        {errorMsg && (
                            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                                {errorMsg}
                            </div>
                        )}

                        {tab === 'register' ? (
                            /* Register Form */
                            <form onSubmit={handleRegister} className="space-y-4">
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                            Email Address *
                                        </label>
                                        <Input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="manager@example.com"
                                            className="mt-1"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Username *
                                            </label>
                                            <Input
                                                required
                                                value={username}
                                                onChange={(e) => setUsername(e.target.value)}
                                                placeholder="BafanaBoss"
                                                className="mt-1"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Password *
                                            </label>
                                            <div className="relative mt-1">
                                                <Input
                                                    type={showPassword ? 'text' : 'password'}
                                                    required
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    placeholder="At least 6 chars"
                                                    className="pr-9"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                >
                                                    {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                            Fantasy Team Name
                                        </label>
                                        <Input
                                            value={fantasyTeamName}
                                            onChange={(e) => setFantasyTeamName(e.target.value)}
                                            placeholder={username ? `${username}'s XI` : 'e.g. Amakhosi Warriors'}
                                            className="mt-1"
                                        />
                                    </div>

                                    {/* Club Selector on Registration */}
                                    <div className="space-y-1.5 pt-1">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                                <Shield size={14} className="text-primary" />
                                                <span>Which PSL Club Do You Support? *</span>
                                            </label>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground leading-snug">
                                            Touchline will customize live scores, news, and dashboard accents to cater to your team.
                                        </p>

                                        <div className="grid grid-cols-4 gap-2 max-h-44 overflow-y-auto p-1.5 border rounded-2xl bg-muted/20">
                                            {PSL_CLUBS.map((club) => {
                                                const isSelected = selectedClubId === club.id;
                                                return (
                                                    <button
                                                        key={club.id}
                                                        type="button"
                                                        onClick={() => setSelectedClubId(club.id)}
                                                        className={cn(
                                                            'relative flex flex-col items-center gap-1 rounded-xl p-2 text-center transition-all',
                                                            isSelected
                                                                ? 'bg-white shadow-md ring-2 ring-primary'
                                                                : 'hover:bg-background/80 opacity-70 hover:opacity-100'
                                                        )}
                                                    >
                                                        <TeamCrest crest={club.crest} name={club.name} size={28} />
                                                        <span className="text-[10px] font-semibold truncate w-full">
                                                            {club.shortCode || club.name}
                                                        </span>
                                                        {isSelected && (
                                                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white">
                                                                <CheckCircle size={12} weight="fill" />
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full flex items-center justify-center gap-2 mt-4"
                                >
                                    {submitting ? (
                                        <>
                                            <CircleNotch size={16} className="animate-spin" />
                                            <span>Creating Account...</span>
                                        </>
                                    ) : (
                                        <span>Create Account & Join Fantasy</span>
                                    )}
                                </Button>
                            </form>
                        ) : (
                            /* Login Form */
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                            Email or Username
                                        </label>
                                        <Input
                                            required
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            placeholder="manager@example.com or username"
                                            className="mt-1"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                            Password
                                        </label>
                                        <div className="relative mt-1">
                                            <Input
                                                type={showPassword ? 'text' : 'password'}
                                                required
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="Enter your password"
                                                className="pr-9"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full flex items-center justify-center gap-2 mt-4"
                                >
                                    {submitting ? (
                                        <>
                                            <CircleNotch size={16} className="animate-spin" />
                                            <span>Signing In...</span>
                                        </>
                                    ) : (
                                        <span>Sign In</span>
                                    )}
                                </Button>
                            </form>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
