import { prisma } from './config/database.js';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { GNewsProvider } from './providers/gnews.provider.js';
import { NewsSyncService } from './services/news-sync.service.js';
import { logger } from './utils/logger.js';

const app = createApp(prisma);

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Touchline News API is running');
});

if (env.NEWS_SYNC_ENABLED && env.GNEWS_API_KEY) {
  const syncService = new NewsSyncService(prisma, [new GNewsProvider()]);
  const intervalMs = env.NEWS_SYNC_INTERVAL_MINUTES * 60 * 1000;

  setInterval(() => {
    syncService.sync().catch((error) => logger.error({ error }, 'Scheduled news sync failed'));
  }, intervalMs);
}

const shutdown = async () => {
  logger.info('Shutting down Touchline News API');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
