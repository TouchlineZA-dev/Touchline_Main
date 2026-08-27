import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { SourcesController } from '../controllers/sources.controller.js';
import { asyncHandler } from './async-handler.js';

export const createSourcesRouter = (db: PrismaClient) => {
  const router = Router();
  const controller = new SourcesController(db);

  router.get('/', asyncHandler(controller.list));

  return router;
};
