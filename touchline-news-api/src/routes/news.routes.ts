import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { NewsController } from '../controllers/news.controller.js';
import { asyncHandler } from './async-handler.js';

export const createNewsRouter = (db: PrismaClient) => {
  const router = Router();
  const controller = new NewsController(db);

  router.get('/', asyncHandler(controller.list));
  router.get('/search', asyncHandler(controller.search));
  router.get('/category/:category', asyncHandler(controller.byCategory));
  router.get('/:id', asyncHandler(controller.getById));

  return router;
};
