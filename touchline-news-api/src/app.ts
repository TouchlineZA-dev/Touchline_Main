import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import type { PrismaClient } from '@prisma/client';
import { prisma } from './config/database.js';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { apiRateLimiter } from './middleware/rate-limit.middleware.js';
import { createCategoriesRouter } from './routes/categories.routes.js';
import { createNewsRouter } from './routes/news.routes.js';
import { createSourcesRouter } from './routes/sources.routes.js';
import { createTeamsRouter } from './routes/teams.routes.js';

const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Touchline News API',
    version: '1.0.0',
    description: 'Database-backed South African football news API for TouchlineZa.'
  },
  paths: {
    '/api/health': { get: { summary: 'Check API health' } },
    '/api/news': { get: { summary: 'List paginated news articles' } },
    '/api/news/{id}': { get: { summary: 'Get one article by id' } },
    '/api/news/search': { get: { summary: 'Search news articles' } },
    '/api/news/category/{category}': { get: { summary: 'List news by category' } },
    '/api/teams/{team}/news': { get: { summary: 'List news by team name or slug' } },
    '/api/categories': { get: { summary: 'List categories' } },
    '/api/sources': { get: { summary: 'List active sources' } },
    '/api/teams': { get: { summary: 'List teams' } }
  }
};

export const createApp = (db: PrismaClient = prisma) => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : allowedOrigins,
      credentials: true
    })
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use('/api', apiRateLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'touchline-news-api',
      timestamp: new Date().toISOString()
    });
  });

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.use('/api/news', createNewsRouter(db));
  app.use('/api/teams', createTeamsRouter(db));
  app.use('/api/categories', createCategoriesRouter(db));
  app.use('/api/sources', createSourcesRouter(db));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
