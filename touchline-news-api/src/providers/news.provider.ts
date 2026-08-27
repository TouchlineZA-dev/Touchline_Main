import type { ProviderArticle } from '../types/news.js';

export interface NewsProvider {
  name: string;
  fetchArticles(): Promise<ProviderArticle[]>;
}
