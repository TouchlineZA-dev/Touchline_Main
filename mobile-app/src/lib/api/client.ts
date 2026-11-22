import { AppConfig } from '../config/env';
import { supabase } from '../auth/supabaseClient';
import {
  ApiArticle,
  ApiFixture,
  ApiPlayer,
  ApiStanding,
  FantasyLeague,
  FantasyTeam,
  LeagueStanding,
  SaveTeamPayload,
} from './types';

class ApiClient {
  private baseUrl = AppConfig.apiBaseUrl;

  private async getAuthToken(): Promise<string | null> {
    try {
      const { data } = await supabase.auth.getSession();
      return data?.session?.access_token ?? null;
    } catch {
      return null;
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `Request failed (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData?.error) errorMessage = errorData.error;
      } catch {
        // Fallback to generic message
      }
      throw new Error(errorMessage);
    }

    return response.json() as Promise<T>;
  }

  // --- Public Football Endpoints ---
  async getNews(max = 20): Promise<{ articles: ApiArticle[] }> {
    return this.request<{ articles: ApiArticle[] }>(`/news/headlines?max=${max}`);
  }

  async getPlayers(): Promise<{ players: ApiPlayer[] }> {
    return this.request<{ players: ApiPlayer[] }>('/players');
  }

  async getFixtures(): Promise<{ fixtures: ApiFixture[] }> {
    return this.request<{ fixtures: ApiFixture[] }>('/fixtures');
  }

  async getStandings(): Promise<{ standings: ApiStanding[] }> {
    return this.request<{ standings: ApiStanding[] }>('/standings');
  }

  // --- Authenticated Fantasy Endpoints (ASP.NET API) ---
  async getFantasyTeam(): Promise<{ team: FantasyTeam | null }> {
    return this.request<{ team: FantasyTeam | null }>('/fantasy/team');
  }

  async saveFantasyTeam(payload: SaveTeamPayload): Promise<{ team: FantasyTeam }> {
    return this.request<{ team: FantasyTeam }>('/fantasy/team', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async activateChip(chip: string): Promise<{ team: FantasyTeam }> {
    return this.request<{ team: FantasyTeam }>('/fantasy/chip', {
      method: 'POST',
      body: JSON.stringify({ chip }),
    });
  }

  async getMyLeagues(): Promise<{ leagues: FantasyLeague[] }> {
    return this.request<{ leagues: FantasyLeague[] }>('/fantasy/leagues');
  }

  async createLeague(name: string): Promise<{ league: FantasyLeague }> {
    return this.request<{ league: FantasyLeague }>('/fantasy/leagues', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async joinLeague(code: string): Promise<{ membership: any }> {
    return this.request<{ membership: any }>('/fantasy/leagues/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async getLeagueStandings(leagueId: string, gameweek?: number): Promise<{ standings: LeagueStanding[] }> {
    const query = gameweek ? `?gameweek=${gameweek}` : '';
    return this.request<{ standings: LeagueStanding[] }>(`/fantasy/leagues/${leagueId}/standings${query}`);
  }
}

export const api = new ApiClient();
