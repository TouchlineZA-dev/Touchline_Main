import type { Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';

export class SourcesController {
  constructor(private readonly db: PrismaClient) {}

  list = async (_req: Request, res: Response) => {
    const sources = await this.db.source.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, website: true, type: true }
    });
    res.json({ sources });
  };
}
