import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { CategoriesController } from '../controllers/categories.controller.js';
import { asyncHandler } from './async-handler.js';

export const createCategoriesRouter = (db: PrismaClient) => {
  const router = Router();
  const controller = new CategoriesController(db);

  router.get('/', asyncHandler(controller.list));

  return router;
};
