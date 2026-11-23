import type { Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';

export class CategoriesController {
  constructor(private readonly db: PrismaClient) {}

  list = async (_req: Request, res: Response) => {
    const categories = await this.db.category.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true }
    });
    res.json({ categories });
  };
}
