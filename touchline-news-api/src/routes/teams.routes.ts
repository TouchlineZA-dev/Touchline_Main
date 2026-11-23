import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { TeamsController } from '../controllers/teams.controller.js';
import { asyncHandler } from './async-handler.js';

export const createTeamsRouter = (db: PrismaClient) => {
  const router = Router();
  const controller = new TeamsController(db);

  router.get('/', asyncHandler(controller.list));
  router.get('/:team/news', asyncHandler(controller.news));

  return router;
};
