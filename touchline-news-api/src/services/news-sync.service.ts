import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { NewsProvider } from '../providers/news.provider.js';
import type { ProviderArticle } from '../types/news.js';
import { normalizeTitle, normalizeUrl } from '../utils/deduplicate.js';
import { logger } from '../utils/logger.js';
import { CategorizationService } from './categorization.service.js';
import { type DetectedTeam, TeamDetectionService } from './team-detection.service.js';

const providerArticleSchema = z.object({
  title: z.string().trim().min(5),
  summary: z.string().nullable().optional(),
  source: z.string().trim().min(1),
  sourceId: z.string().nullable().optional(),
  publishedAt: z.date(),
  url: z.string().trim().url(),
  imageUrl: z.string().trim().url().nullable().optional()
});

export interface SyncSummary {
  provider: string;
  found: number;
  inserted: number;
  duplicates: number;
  invalid: number;
  failed: number;
  message?: string;
}

const relevanceKeywords = [
  'south africa',
  'south african',
  'psl',
  'premier soccer league',
  'betway premiership',
  'dstv premiership',
  'nedbank cup',
  'mt8',
  'bafana bafana',
  'banyana banyana',
  'kaizer chiefs',
  'orlando pirates',
  'mamelodi sundowns'
];

export class NewsSyncService {
  private readonly categorizer = new CategorizationService();
  private readonly teamDetector: TeamDetectionService;

  constructor(
    private readonly db: PrismaClient,
    private readonly providers: NewsProvider[]
  ) {
    this.teamDetector = new TeamDetectionService(db);
  }

  async sync(): Promise<SyncSummary[]> {
    const summaries: SyncSummary[] = [];

    for (const provider of this.providers) {
      summaries.push(await this.syncProvider(provider));
    }

    return summaries;
  }

  private async syncProvider(provider: NewsProvider): Promise<SyncSummary> {
    const summary: SyncSummary = {
      provider: provider.name,
      found: 0,
      inserted: 0,
      duplicates: 0,
      invalid: 0,
      failed: 0
    };

    try {
      const articles = await provider.fetchArticles();
      summary.found = articles.length;

      for (const article of articles) {
        const outcome = await this.storeArticle(article);
        summary[outcome] += 1;
      }
    } catch (error) {
      summary.failed += 1;
      summary.message = error instanceof Error ? error.message : 'Unknown provider error';
      logger.error({ error, provider: provider.name }, 'News provider sync failed');
    }

    await this.db.syncLog.create({ data: summary });
    return summary;
  }

  private async storeArticle(article: ProviderArticle): Promise<'inserted' | 'duplicates' | 'invalid'> {
    const parsed = providerArticleSchema.safeParse({
      ...article,
      url: normalizeUrl(article.url)
    });

    if (!parsed.success) return 'invalid';

    const data = parsed.data;
    const normalizedTitle = normalizeTitle(data.title);
    const teams = await this.teamDetector.detect(data.title, data.summary ?? '');

    if (!this.isRelevant(data, teams)) return 'invalid';

    const duplicate = await this.db.article.findFirst({
      where: {
        OR: [
          { url: data.url },
          { normalizedTitle },
          ...(data.sourceId ? [{ source: data.source, sourceId: data.sourceId }] : [])
        ]
      }
    });

    if (duplicate) return 'duplicates';

    await this.db.article.create({
      data: {
        title: data.title,
        normalizedTitle,
        summary: data.summary ?? null,
        source: data.source,
        sourceId: data.sourceId ?? null,
        publishedAt: data.publishedAt,
        url: data.url,
        imageUrl: data.imageUrl ?? null,
        category: this.categorizer.categorize(data.title, data.summary ?? ''),
        teams: {
          create: teams.map((team) => ({
            team: { connect: { id: team.id } }
          }))
        }
      }
    });

    return 'inserted';
  }

  private isRelevant(article: z.infer<typeof providerArticleSchema>, teams: DetectedTeam[]) {
    if (teams.length > 0) return true;
    const text = `${article.title} ${article.summary ?? ''}`.toLowerCase();
    return relevanceKeywords.some((keyword) => text.includes(keyword));
  }
}
