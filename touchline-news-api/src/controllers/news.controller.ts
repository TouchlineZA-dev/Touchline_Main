import type { Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { NewsService } from '../services/news.service.js';
import { AppError } from '../middleware/error.middleware.js';

export class NewsController {
  private readonly newsService: NewsService;

  constructor(db: PrismaClient) {
    this.newsService = new NewsService(db);
  }

  list = async (req: Request, res: Response) => {
    res.json(await this.newsService.list(req.query));
  };

  getById = async (req: Request, res: Response) => {
    if (!req.params.id) throw new AppError(400, 'Article id is required', 'ARTICLE_ID_REQUIRED');
    const article = await this.newsService.getById(req.params.id);
    if (!article) throw new AppError(404, 'News article was not found', 'ARTICLE_NOT_FOUND');
    res.json({ article });
  };

  search = async (req: Request, res: Response) => {
    res.json(await this.newsService.search(req.query));
  };

  byCategory = async (req: Request, res: Response) => {
    if (!req.params.category) {
      throw new AppError(400, 'Category is required', 'CATEGORY_REQUIRED');
    }
    res.json(await this.newsService.byCategory(req.params.category, req.query));
  };
}
