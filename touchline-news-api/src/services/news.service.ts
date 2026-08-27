import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { ArticleDto, PaginatedArticles } from '../types/news.js';

export const listNewsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  category: z.string().trim().optional(),
  team: z.string().trim().optional(),
  source: z.string().trim().optional(),
  sort: z.enum(['publishedAt:desc', 'publishedAt:asc']).default('publishedAt:desc')
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Search query must be at least 2 characters'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export class NewsService {
  constructor(private readonly db: PrismaClient) {}

  async list(rawQuery: unknown): Promise<PaginatedArticles> {
    const query = listNewsQuerySchema.parse(rawQuery);
    const where: Record<string, unknown> = {};

    if (query.category) where.category = { equals: query.category, mode: 'insensitive' };
    if (query.source) where.source = { equals: query.source, mode: 'insensitive' };
    if (query.team) {
      where.teams = {
        some: {
          team: {
            OR: [
              { name: { equals: query.team, mode: 'insensitive' } },
              { slug: { equals: query.team.toLowerCase().replace(/\s+/g, '-'), mode: 'insensitive' } },
              { aliases: { has: query.team } }
            ]
          }
        }
      };
    }

    return this.findMany(where, query.page, query.limit, {
      publishedAt: query.sort.endsWith('asc') ? 'asc' : 'desc'
    });
  }

  async getById(id: string): Promise<ArticleDto | null> {
    const article = await this.db.article.findUnique({
      where: { id },
      include: { teams: { include: { team: true } } }
    });
    return article ? toArticleDto(article) : null;
  }

  async search(rawQuery: unknown): Promise<PaginatedArticles> {
    const query = searchQuerySchema.parse(rawQuery);
    const where: Record<string, unknown> = {
      OR: [
        { title: { contains: query.q, mode: 'insensitive' } },
        { summary: { contains: query.q, mode: 'insensitive' } },
        { source: { contains: query.q, mode: 'insensitive' } },
        { category: { contains: query.q, mode: 'insensitive' } },
        { teams: { some: { team: { name: { contains: query.q, mode: 'insensitive' } } } } }
      ]
    };
    return this.findMany(where, query.page, query.limit);
  }

  async byCategory(category: string, rawQuery: unknown) {
    return this.list({ ...(rawQuery as object), category });
  }

  async byTeam(team: string, rawQuery: unknown) {
    return this.list({ ...(rawQuery as object), team });
  }

  private async findMany(
    where: Record<string, unknown>,
    page: number,
    limit: number,
    orderBy: Record<string, 'asc' | 'desc'> = { publishedAt: 'desc' }
  ): Promise<PaginatedArticles> {
    const [total, articles] = await Promise.all([
      this.db.article.count({ where }),
      this.db.article.findMany({
        where,
        include: { teams: { include: { team: true } } },
        orderBy,
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    return {
      articles: articles.map(toArticleDto),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}

type ArticleWithTeams = {
  id: string;
  title: string;
  summary: string | null;
  source: string;
  publishedAt: Date;
  url: string;
  imageUrl: string | null;
  category: string;
  teams: Array<{ team: { name: string } }>;
};

export const toArticleDto = (article: ArticleWithTeams): ArticleDto => ({
  id: article.id,
  title: article.title,
  summary: article.summary,
  source: article.source,
  publishedAt: article.publishedAt.toISOString(),
  url: article.url,
  imageUrl: article.imageUrl,
  category: article.category,
  teams: article.teams.map((row) => row.team.name)
});
