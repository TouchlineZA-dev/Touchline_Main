export interface ProviderArticle {
  title: string;
  summary?: string | null;
  source: string;
  sourceId?: string | null;
  publishedAt: Date;
  url: string;
  imageUrl?: string | null;
}

export interface ArticleDto {
  id: string;
  title: string;
  summary: string | null;
  source: string;
  publishedAt: string;
  url: string;
  imageUrl: string | null;
  category: string;
  teams: string[];
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedArticles {
  articles: ArticleDto[];
  pagination: Pagination;
}
