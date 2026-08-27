import { prisma } from '../src/config/database.js';
import { GNewsProvider } from '../src/providers/gnews.provider.js';
import { NewsSyncService } from '../src/services/news-sync.service.js';
import { logger } from '../src/utils/logger.js';

const syncService = new NewsSyncService(prisma, [new GNewsProvider()]);

syncService
  .sync()
  .then((summary) => {
    logger.info({ summary }, 'News sync completed');
  })
  .catch((error) => {
    logger.error({ error }, 'News sync failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
