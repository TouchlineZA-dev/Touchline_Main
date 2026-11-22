import { AppConfig } from '../config/env';
import { supabase } from '../auth/supabaseClient';
import {
  ApiArticle,
  ApiFixture,
  ApiPlayer,
  ApiTeam,
  FantasyTeam,
  Gameweek,
  LeagueStandings,
  LeagueSummary,
  Me,
  NewsCategory,
  Season,
  SeasonRef,
  Snapshot,
  Squad,
  SquadRequest,
  TeamPoints,
} from './types';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends RequestInit {
  auth?: boolean;
  baseUrl?: string;
}

class ApiClient {
  private async getAuthToken(): Promise<string | null> {
    try {
      const { data } = await supabase.auth.getSession();
      return data?.session?.access_token ?? null;
    } catch {
      return null;
    }
  }

  private async request<T>(path: string, { auth = false, baseUrl = AppConfig.apiBaseUrl, ...options }: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };
    if (options.body) headers['Content-Type'] = 'application/json';

    if (auth) {
      const token = await this.getAuthToken();
      if (!token) throw new ApiError('Sign in to continue.', 401);
      headers.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AppConfig.requestTimeoutMs);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, { ...options, headers, signal: controller.signal });
    } catch (e) {
      const aborted = (e as Error)?.name === 'AbortError';
      throw new ApiError(
        aborted ? 'The server took too long to respond.' : `Can't reach the server at ${baseUrl}.`,
        0,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try {
        // ASP.NET returns ProblemDetails ({ title, detail }); the news service returns { error }.
        const body = await response.json();
        message = body?.detail || body?.error?.message || body?.error || body?.title || message;
      } catch {
        // keep generic message
      }
      throw new ApiError(String(message), response.status);
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  // --- Public football endpoints ---
  getCurrentSeason() {
    return this.request<Season>('/seasons/current');
  }

  getTeams() {
    return this.request<{ count: number; teams: ApiTeam[] }>('/teams');
  }

  getPlayers() {
    return this.request<{ season: SeasonRef; count: number; players: ApiPlayer[] }>('/players');
  }

  getFixtures(range: { from?: Date; to?: Date } = {}) {
    const params = new URLSearchParams();
    if (range.from) params.set('from', range.from.toISOString());
    if (range.to) params.set('to', range.to.toISOString());
    const qs = params.toString();
    return this.request<{ season: SeasonRef; count: number; fixtures: ApiFixture[] }>(`/fixtures${qs ? `?${qs}` : ''}`);
  }

  getGameweeks(seasonId?: number) {
    return this.request<{ count: number; gameweeks: Gameweek[] }>(`/gameweeks${seasonId ? `?seasonId=${seasonId}` : ''}`);
  }

  // --- News service ---
  getNews(opts: { limit?: number; category?: string } = {}) {
    const params = new URLSearchParams({ limit: String(opts.limit ?? 20) });
    if (opts.category) params.set('category', opts.category);
    return this.request<{ articles: ApiArticle[] }>(`/news?${params}`, { baseUrl: AppConfig.newsApiBaseUrl });
  }

  getNewsCategories() {
    return this.request<{ categories: NewsCategory[] }>('/categories', { baseUrl: AppConfig.newsApiBaseUrl });
  }

  // --- Authenticated endpoints ---
  getMe() {
    return this.request<Me>('/me', { auth: true });
  }

  getFantasyTeam() {
    return this.request<FantasyTeam>('/fantasy/team', { auth: true });
  }

  createFantasyTeam(name: string) {
    return this.request<FantasyTeam>('/fantasy/team', { auth: true, method: 'POST', body: JSON.stringify({ name }) });
  }

  getSnapshot() {
    return this.request<Snapshot>('/fantasy/team/snapshot', { auth: true });
  }

  getSquad(gameweek?: number) {
    return this.request<Squad>(`/fantasy/team/squad${gameweek ? `?gameweek=${gameweek}` : ''}`, { auth: true });
  }

  saveSquad(payload: SquadRequest) {
    return this.request<Squad>('/fantasy/team/squad', { auth: true, method: 'PUT', body: JSON.stringify(payload) });
  }

  getPoints(gameweek?: number) {
    return this.request<TeamPoints>(`/fantasy/team/points${gameweek ? `?gameweek=${gameweek}` : ''}`, { auth: true });
  }

  activateChip(chip: string, gameweek?: number) {
    return this.request<Squad>('/fantasy/team/chips', { auth: true, method: 'POST', body: JSON.stringify({ chip, gameweek }) });
  }

  getMyLeagues() {
    return this.request<LeagueSummary[]>('/fantasy/leagues', { auth: true });
  }

  createLeague(name: string) {
    return this.request<LeagueSummary>('/fantasy/leagues', { auth: true, method: 'POST', body: JSON.stringify({ name }) });
  }

  joinLeague(code: string) {
    return this.request<LeagueSummary>('/fantasy/leagues/join', { auth: true, method: 'POST', body: JSON.stringify({ code }) });
  }

  getLeagueStandings(leagueId: string, gameweek?: number) {
    const query = gameweek ? `?gameweek=${gameweek}` : '';
    return this.request<LeagueStandings>(`/fantasy/leagues/${encodeURIComponent(leagueId)}/standings${query}`, { auth: true });
  }
}

export const api = new ApiClient();
