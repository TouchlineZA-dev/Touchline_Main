import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  GNEWS_API_KEY: z.string().optional().default(''),
  GNEWS_BASE_URL: z.string().url().default('https://gnews.io/api/v4/search'),
  GNEWS_QUERIES: z
    .string()
    .default(
      'South African football,PSL,Betway Premiership,Kaizer Chiefs,Orlando Pirates,Mamelodi Sundowns,AmaZulu,Stellenbosch FC,Sekhukhune United,Cape Town City,Bafana Bafana'
    ),
  CORS_ORIGIN: z.string().default('http://localhost:8080'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  NEWS_SYNC_ENABLED: z
    .string()
    .default('true')
    .transform((value) => value === 'true'),
  NEWS_SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(10)
});

const rawEnv = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ??
    (process.env.NODE_ENV === 'test'
      ? 'postgresql://touchline:touchline@localhost:5432/touchline_news_test'
      : undefined)
};

export const env = envSchema.parse(rawEnv);

export const newsQueries = env.GNEWS_QUERIES.split(',')
  .map((query) => query.trim())
  .filter(Boolean);
