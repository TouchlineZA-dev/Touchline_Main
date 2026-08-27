import type { Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/error.middleware.js';
import { NewsService } from '../services/news.service.js';

export class TeamsController {
  private readonly newsService: NewsService;

  constructor(private readonly db: PrismaClient) {
    this.newsService = new NewsService(db);
  }

  list = async (_req: Request, res: Response) => {
    const teams = await this.db.team.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, shortName: true, slug: true, logoUrl: true, aliases: true }
    });
    res.json({ teams });
  };

  news = async (req: Request, res: Response) => {
    if (!req.params.team) throw new AppError(400, 'Team is required', 'TEAM_REQUIRED');
    res.json(await this.newsService.byTeam(req.params.team, req.query));
  };
}
