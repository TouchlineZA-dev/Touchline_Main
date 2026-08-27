# Touchline News API Handoff

This is an API-only implementation. No UI is included or required.

## What Was Built

A standalone backend package was added at:

```text
touchline-news-api/
```

It provides a database-backed South African football news API for TouchlineZa. The API reads from PostgreSQL/Supabase through Prisma, stores normalized articles, detects teams/categories, removes duplicates, and exposes REST endpoints for the frontend or any other backend service to consume.

## Validation Status

These checks passed locally:

```bash
cd touchline-news-api
npm run build
npm test
```

Test result:

```text
4 test files passed
6 tests passed
```

Note: `npm install` reported dependency audit warnings from installed packages. No automatic `npm audit fix --force` was run because that can introduce breaking dependency changes.

## How To Run The API Alone

From the repository root:

```bash
cd touchline-news-api
npm install
copy .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="postgresql://touchline:touchline@localhost:5432/touchline_news"
PORT=3000
GNEWS_API_KEY=""
GNEWS_BASE_URL="https://gnews.io/api/v4/search"
CORS_ORIGIN="http://localhost:8080"
NEWS_SYNC_ENABLED=true
NEWS_SYNC_INTERVAL_MINUTES=10
```

For Supabase, use the Supabase Postgres connection string as `DATABASE_URL`.

Then run:

```bash
npm run migrate
npm run seed
npm run dev
```

Health check:

```bash
curl http://localhost:3000/api/health
```

API docs:

```text
http://localhost:3000/api/docs
```

## Manual News Sync

Configure `GNEWS_API_KEY` in `.env`, then run:

```bash
npm run sync
```

The server can also run scheduled syncs when:

```env
NEWS_SYNC_ENABLED=true
GNEWS_API_KEY="your_key_here"
```

## Endpoints

```text
GET /api/health
GET /api/news
GET /api/news/:id
GET /api/news/search?q=kaizer
GET /api/news/category/:category
GET /api/teams/:team/news
GET /api/categories
GET /api/sources
GET /api/teams
GET /api/docs
```

Supported `/api/news` query params:

```text
page
limit
category
team
source
sort=publishedAt:desc
sort=publishedAt:asc
```

Example:

```bash
curl "http://localhost:3000/api/news?page=1&limit=10&team=Kaizer%20Chiefs&category=PSL"
```

## Database Tables

Prisma models are defined in:

```text
touchline-news-api/prisma/schema.prisma
```

Main tables:

```text
Article
Team
Category
Source
ArticleTeam
SyncLog
```

The migration SQL is here:

```text
touchline-news-api/prisma/migrations/20260827000000_init/migration.sql
```

## Important Source Files

Server entry:

```text
touchline-news-api/src/server.ts
```

Express app:

```text
touchline-news-api/src/app.ts
```

Database client:

```text
touchline-news-api/src/config/database.ts
```

Environment validation:

```text
touchline-news-api/src/config/env.ts
```

News querying:

```text
touchline-news-api/src/services/news.service.ts
```

Provider sync:

```text
touchline-news-api/src/services/news-sync.service.ts
```

GNews provider:

```text
touchline-news-api/src/providers/gnews.provider.ts
```

Seed data:

```text
touchline-news-api/scripts/seed.ts
```

## Instructions For The Other AI Workstation

1. Treat `touchline-news-api/` as a standalone backend package.
2. Do not add UI work in this package.
3. Run `npm install`, `npm run build`, and `npm test` before changing behavior.
4. Configure a real PostgreSQL or Supabase `DATABASE_URL`.
5. Run `npm run migrate` and `npm run seed`.
6. If integrating into an existing backend, move the Prisma models/migration first, then port the services/controllers/routes.
7. Keep the database as the source of truth. The frontend should call the API endpoints, not GNews directly.
8. Add any future news source as a new provider implementing `src/providers/news.provider.ts`.
9. Do not scrape publishers directly unless there is explicit legal/product approval.
10. Preserve duplicate checks by URL, source/sourceId, and normalized title.

## Integration Notes

If merging this into another Express backend:

```ts
import { createNewsRouter } from './routes/news.routes.js';
import { createTeamsRouter } from './routes/teams.routes.js';
import { createCategoriesRouter } from './routes/categories.routes.js';
import { createSourcesRouter } from './routes/sources.routes.js';

app.use('/api/news', createNewsRouter(prisma));
app.use('/api/teams', createTeamsRouter(prisma));
app.use('/api/categories', createCategoriesRouter(prisma));
app.use('/api/sources', createSourcesRouter(prisma));
```

If the other backend already has Prisma, merge the schema models instead of creating a second Prisma client.

If the other backend already has logging, CORS, rate limiting, or error middleware, reuse its existing middleware and only port the route/service/provider logic.

## Current Local Paths

Full API folder:

```text
C:\Users\Admin\local Touchline collaboration\touchline-news-api
```

This handoff file:

```text
C:\Users\Admin\local Touchline collaboration\TOUCHLINE_NEWS_API_HANDOFF.md
```
