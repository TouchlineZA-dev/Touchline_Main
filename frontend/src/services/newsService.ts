// Firebase imports are now used only for fixtures/standings (see fetchFixtures, fetchStandings, etc.)
// News no longer uses Firestore � backend aggregates all sources and frontend caches locally
import { db } from '@/integrations/firebase/client';
import { collection, getDocs, query, orderBy, limit, Timestamp } from 'firebase/firestore';

export interface NewsArticle {
    id: string;
    title: string;
    summary: string;
    date: string;
    publishedAt?: any; // Firestore Timestamp
    source: string;
    imageUrl: string;
    tag: string;
    tagColor: string;
    url: string;
}

export const setStoredNewsApiKey = (key: string) => {
    localStorage.setItem('psl_user_api_key', key);
};

export const getStoredNewsApiKey = () => {
    return localStorage.getItem('psl_user_api_key');
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');


const CACHE_KEY_NEWS = 'cached_psl_news_v2';
const CACHE_KEY_FIXTURES = 'cached_live_fixtures';
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours

const saveToCache = (key: string, data: any) => {
    try {
        const cacheEntry = {
            timestamp: Date.now(),
            data: data
        };
        localStorage.setItem(key, JSON.stringify(cacheEntry));
    } catch (e) {
        console.warn('Failed to save to cache:', e);
    }
};

const getFromCache = (key: string): any | null => {
    try {
        const cached = localStorage.getItem(key);
        if (!cached) return null;

        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp > CACHE_DURATION) {
            console.log(`Cache for ${key} expired.`);
            return null;
        }
        return data;
    } catch (e) {
        console.warn('Failed to read from cache:', e);
        return null;
    }
};

const articleId = (item: any): string => {
    try {
        return btoa(item.url || item.title || String(Date.now()))
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(0, 20);
    } catch {
        return `news_${Date.now()}`;
    }
};

const getFallbackImage = (title: string): string => {
    const lowerTitle = title.toLowerCase();

    // Kaizer Chiefs (Yellow/Gold vibes)
    if (lowerTitle.includes('chiefs') || lowerTitle.includes('amakhosi') || lowerTitle.includes('naturena')) {
        return 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?auto=format&fit=crop&q=80&w=800';
    }
    // Orlando Pirates (Black/White/Dark vibes)
    if (lowerTitle.includes('pirates') || lowerTitle.includes('buccaneers')) {
        return 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=800';
    }
    // Sundowns (Yellow/Blue/Bright)
    if (lowerTitle.includes('sundowns') || lowerTitle.includes('downs') || lowerTitle.includes('masandawana')) {
        return 'https://images.unsplash.com/photo-1614632537423-1e6c2e7e0aab?auto=format&fit=crop&q=80&w=800';
    }
    // National Team
    if (lowerTitle.includes('bafana')) {
        return 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=800';
    }
    // Transfers (Business/Writing/Jersey)
    if (lowerTitle.includes('transfer') || lowerTitle.includes('sign') || lowerTitle.includes('deal')) {
        return 'https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&q=80&w=800';
    }

    // General Football variants to avoid monotony
    const generals = [
        'https://images.unsplash.com/photo-1522778119026-d647f0565c6a?auto=format&fit=crop&q=80&w=800',
        'https://images.unsplash.com/photo-1517466787929-bc90951d6dbd?auto=format&fit=crop&q=80&w=800',
        'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&q=80&w=800',
        'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&q=80&w=800'
    ];

    // Pick based on title length hash to be deterministic for same title
    const index = title.length % generals.length;
    return generals[index];
};

const classifyArticle = (title: string, summary: string): { tag: string; tagColor: string } => {
    const text = `${title} ${summary}`.toLowerCase();

    if (text.includes('transfer') || text.includes('sign') || text.includes('deal') || text.includes('loan')) {
        return { tag: 'Transfer', tagColor: 'bg-orange-500' };
    }

    if (text.includes('bafana') || text.includes('national team') || text.includes('south africa')) {
        return { tag: 'National Team', tagColor: 'bg-blue-600' };
    }

    if (text.includes('coach') || text.includes('manager') || text.includes('board') || text.includes('sack')) {
        return { tag: 'Management', tagColor: 'bg-purple-600' };
    }

    return { tag: 'PSL Giants', tagColor: 'bg-green-600' };
};

const mapBackendArticle = (item: any): NewsArticle => {
    const summary = item.summary || item.description || item.content || '';
    const title = item.title || 'Untitled story';
    const { tag, tagColor } = classifyArticle(title, summary);
    const sourceName = typeof item.source === 'string'
        ? item.source
        : item.source?.name || 'Touchline News';

    return {
        id: articleId(item),
        title,
        summary,
        date: formatRelativeTime(item.publishedAt),
        publishedAt: item.publishedAt,
        source: sourceName,
        imageUrl: item.imageUrl || item.image || getFallbackImage(title),
        tag: item.tag || tag,
        tagColor: item.tagColor || tagColor,
        url: item.url || '#'
    };
};

const fetchNewsFromBackend = async (max = 10): Promise<NewsArticle[]> => {
    const response = await fetch(`${API_BASE_URL}/news/headlines?max=${max}`);

    if (!response.ok) {
        throw new Error(`Backend request failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.articles || !Array.isArray(data.articles)) {
        return [];
    }

    return data.articles.map(mapBackendArticle);
};

export const fetchPSLNews = async (_apiKey: string): Promise<NewsArticle[]> => {
    try {
        const articles = await fetchNewsFromBackend(10);
        saveToCache(CACHE_KEY_NEWS, articles);
        return articles;
    } catch (e) {
        console.warn("Supabase news fetch failed, checking local cache...", e);
        const localCached = getFromCache(CACHE_KEY_NEWS);
        if (localCached) return localCached;

        throw new Error(e instanceof Error ? e.message : "Failed to connect to news service");
    }
};

export const ensureNewsSyncedAfterLogin = async (_userId: string): Promise<boolean> => {
    try {
        const articles = await fetchPSLNews('');
        if (articles.length > 0 && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('touchline:news-synced'));
        }
        return articles.length > 0;
    } catch (e) {
        console.warn('News login sync failed:', e);
        return false;
    }
};

export const syncNewsWithAPI = async (_apiKey?: string) => {
    console.log("Fetching news from Supabase-backed backend API...");

    try {
        const articles = await fetchNewsFromBackend(10);
        if (articles.length === 0) {
            console.warn("Backend returned no articles. Skipping clear/write to preserve existing data.");
            return false;
        }

        console.log(`Received ${articles.length} articles from Supabase-backed backend`);
        saveToCache(CACHE_KEY_NEWS, articles);
        return true;

    } catch (e) {
        console.error("News Sync Failed:", e);
        return false;
    }
};




const formatRelativeTime = (dateString: string): string => {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        if (diffInSeconds < 172800) return 'Yesterday';
        return date.toLocaleDateString();
    } catch {
        return 'Recently';
    }
};

export interface Fixture {
    fixtureId: string;
    league: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number | null;
    awayScore: number | null;
    status: 'Not Started' | 'In Progress' | 'Finished' | 'Postponed';
    time: string;
    date: string; // YYYY-MM-DD or readable date string
    syncedAt?: any;
    homeLogo?: string;
    awayLogo?: string;
}

export interface PSLStanding {
    rank: number;
    team: string;
    points: number;
    played: number;
    win: number;
    draw: number;
    loss: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
}

export interface TopScorer {
    rank: number;
    player: string;
    team: string;
    goals: number;
    assists: number;
    played: number;
}

import { pslFixtures as staticFallbackFixtures } from '@/data/pslFixtures';

export const fetchFixtures = async (apiKey?: string): Promise<Fixture[]> => {
    try {
        const fixturesRef = collection(db, 'fixtures');
        const q = query(fixturesRef);
        const querySnapshot = await getDocs(q);

        const cachedFixtures = querySnapshot.docs.map(doc => ({
            ...doc.data(),
            fixtureId: doc.id
        })) as Fixture[];

        // Live data needs frequent sync (every 5 mins if possible, but let's do 10 mins for safety)
        const lastSync = cachedFixtures.length > 0 ? (cachedFixtures[0] as any).syncedAt?.toMillis() : 0;
        const shouldSync = Date.now() - lastSync > (1000 * 60 * 10);

        if (shouldSync) {
            console.log('Fixtures cache is stale. Browser sync is disabled; using stored DB data only.');
            await syncFixturesWithAPI(apiKey);
            const freshSnapshot = await getDocs(q);
            const freshData = freshSnapshot.docs.map(doc => ({
                ...doc.data(),
                fixtureId: doc.id
            })) as Fixture[];

            if (freshData.length > 0) return freshData;
        }

        if (cachedFixtures.length > 0) {
            // Check if we need to sync OLDER fixtures/results because we don't have enough
            // We want at least 5 relevant fixtures.
            const totalRelevant = cachedFixtures.length; // We trust the cache has a mix
            if (totalRelevant < 5) {
                console.log('Not enough fixtures in cache. Browser sync is disabled; keeping stored data only.');
                await syncScheduledFixtures(apiKey);
                // Re-fetch
                const freshSnapshot = await getDocs(q);
                return freshSnapshot.docs.map(doc => ({
                    ...doc.data(),
                    fixtureId: doc.id
                })) as Fixture[];
            }
            return cachedFixtures;
        }

        // --- FALLBACK: If API/Cache is completely empty, use static "Game Week 1" data ---
        console.log("No live/cached fixtures found. Using static First Game Week data.");
        return staticFallbackFixtures.map(f => ({
            fixtureId: f.id,
            league: 'Betway Premiership', // Default league
            homeTeam: f.homeTeam,
            awayTeam: f.awayTeam,
            homeScore: null,
            awayScore: null,
            status: f.status === 'Scheduled' ? 'Not Started' : 'Finished',
            time: f.time,
            date: f.date,
            syncedAt: Timestamp.now(),
            // No logos in static data, View will handle defaults
        }));

    } catch (e) {
        console.warn("Fixture sync failed:", e);
        const cached = getFromCache(CACHE_KEY_FIXTURES);
        if (cached) return cached;

        // Fallback on error too
        console.log("Error fetching live fixtures. Using static data as fallback.");
        return staticFallbackFixtures.map(f => ({
            fixtureId: f.id,
            league: 'Betway Premiership',
            homeTeam: f.homeTeam,
            awayTeam: f.awayTeam,
            homeScore: null,
            awayScore: null,
            status: f.status === 'Scheduled' ? 'Not Started' : 'Finished',
            time: f.time,
            date: f.date,
            syncedAt: Timestamp.now()
        }));
    }
};

const syncFixturesWithAPI = async (_apiKey?: string) => {
    console.log('Fixture sync is DB-only at runtime. Populate Supabase with the backend sync worker.');
};

const syncFixturesWithApiFootball = async (): Promise<boolean> => {
    console.log('API-Football browser sync disabled. Runtime reads must come from stored DB data.');
    return false;
};

const syncStandingsWithApiFootball = async (): Promise<boolean> => {
    console.log('API-Football standings browser sync disabled. Runtime reads must come from stored DB data.');
    return false;
};

const syncScheduledFixtures = async (_apiKey?: string) => {
    console.log('Scheduled fixture browser sync disabled. Runtime reads must come from stored DB data.');
};

export const fetchStandings = async (apiKey?: string): Promise<PSLStanding[]> => {
    try {
        const standingsRef = collection(db, 'standings');
        const q = query(standingsRef, orderBy('rank', 'asc'));
        const querySnapshot = await getDocs(q);

        const cached = querySnapshot.docs.map(doc => doc.data()) as PSLStanding[];

        // Standings change less frequently (every 12 hours)
        const shouldSync = cached.length === 0 ||
            (cached[0] as any).syncedAt?.toMillis() < Date.now() - (1000 * 60 * 60 * 12);

        if (shouldSync) {
            console.log('Standings cache is stale. Browser sync is disabled; using stored DB data only.');
            await syncStandingsWithAPI(apiKey);
            const fresh = await getDocs(q);
            return fresh.docs.map(doc => doc.data()) as PSLStanding[];
        }
        return cached;
    } catch (e) {
        console.error("Standings fetch failed:", e);
        return [];
    }
};

const syncStandingsWithAPI = async (_apiKey?: string) => {
    console.log('Standings browser sync disabled. Runtime reads must come from stored DB data.');
};

export const fetchTopScorers = async (apiKey?: string): Promise<TopScorer[]> => {
    try {
        const scorersRef = collection(db, 'top_scorers');
        const q = query(scorersRef, orderBy('rank', 'asc'), limit(10));
        const querySnapshot = await getDocs(q);

        const cached = querySnapshot.docs.map(doc => doc.data()) as TopScorer[];

        const shouldSync = cached.length === 0 ||
            (cached[0] as any).syncedAt?.toMillis() < Date.now() - (1000 * 60 * 60 * 12);

        if (shouldSync) {
            console.log('Top scorers cache is stale. Browser sync is disabled; using stored DB data only.');
            // In many LiveScore APIs, scorers are part of league info or a separate call
            // Using a simplified mock sync if endpoint is not exactly known, 
            // but structure is ready for actual integration
            await syncScorersWithAPI(apiKey);
            const fresh = await getDocs(q);
            return fresh.docs.map(doc => doc.data()) as TopScorer[];
        }
        return cached;
    } catch (e) {
        return [];
    }
};

const syncScorersWithAPI = async (_apiKey?: string) => {
    console.log('Top scorers browser sync disabled. Runtime reads must come from stored DB data.');
};

const isSouthAfrican = (name: string): boolean => {
    const relevantTerms = ['South Africa', 'Bafana', 'Banyana', 'Kaizer', 'Chiefs', 'Pirates', 'Sundowns', 'Cape Town', 'Stellenbosch', 'Amazulu', 'Golden Arrows', 'Galaxy', 'Sekhukhune', 'Chippa', 'Richards Bay', 'Polokwane', 'Royal AM'];
    return relevantTerms.some(term => name.toLowerCase().includes(term.toLowerCase()));
};
