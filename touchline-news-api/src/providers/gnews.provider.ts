import { env, newsQueries } from '../config/env.js';
import type { ProviderArticle } from '../types/news.js';
import type { NewsProvider } from './news.provider.js';

type GNewsItem = {
  title?: string;
  description?: string;
  content?: string;
  url?: string;
  image?: string;
  publishedAt?: string;
  source?: { name?: string; url?: string };
};

export class GNewsProvider implements NewsProvider {
  name = 'GNews';

  async fetchArticles(): Promise<ProviderArticle[]> {
    if (!env.GNEWS_API_KEY) {
      throw new Error('GNEWS_API_KEY is not configured');
    }

    const batches = await Promise.all(newsQueries.map((query) => this.fetchQuery(query)));
    return batches.flat();
  }

  private async fetchQuery(query: string): Promise<ProviderArticle[]> {
    const url = new URL(env.GNEWS_BASE_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('lang', 'en');
    url.searchParams.set('country', 'za');
    url.searchParams.set('max', '10');
    url.searchParams.set('apikey', env.GNEWS_API_KEY);

    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) {
      throw new Error(`GNews request failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as { articles?: GNewsItem[] };
    return (payload.articles ?? []).map((item) => ({
      title: item.title ?? '',
      summary: item.description ?? item.content ?? null,
      source: item.source?.name ?? 'GNews',
      sourceId: item.url ?? null,
      publishedAt: item.publishedAt ? new Date(item.publishedAt) : new Date(),
      url: item.url ?? '',
      imageUrl: item.image ?? null
    }));
  }
}
