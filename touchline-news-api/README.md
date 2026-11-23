# Touchline News API

Production-ready, database-backed South African football news API for TouchlineZa. It stores normalized articles in PostgreSQL/Supabase, serves them through REST endpoints, and can sync from GNews through a provider-based ingestion layer.

## Features

- Express + TypeScript REST API
- PostgreSQL/Supabase storage through Prisma
- Modular provider architecture, currently including GNews
- Article normalization, duplicate detection, category tagging, and team detection
- Pagination, search, team/category/source filtering
- Rate limiting, CORS, Helmet, structured logging, and error responses
- Docker setup for local API + Postgres
- Swagger UI at `/api/docs`
- Seed data for teams, sources, categories, and test articles

## Setup

```bash
cd touchline-news-api
npm install
cp .env.example .env
```

Update `.env` with your database URL and optional GNews key.

```bash
npm run migrate
npm run seed
npm run dev
```

The API will run on `http://localhost:3000` by default.

## Environment

```env
DATABASE_URL="postgresql://touchline:touchline@localhost:5432/touchline_news"
PORT=3000
GNEWS_API_KEY=""
GNEWS_BASE_URL="https://gnews.io/api/v4/search"
GNEWS_QUERIES="South African football,PSL,Betway Premiership,Kaizer Chiefs,Orlando Pirates,Mamelodi Sundowns,AmaZulu,Stellenbosch FC,Sekhukhune United,Cape Town City,Bafana Bafana"
CORS_ORIGIN="http://localhost:8080"
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
NEWS_SYNC_ENABLED=true
NEWS_SYNC_INTERVAL_MINUTES=10
```

## API Endpoints

- `GET /api/health`
- `GET /api/news?page=1&limit=20&category=PSL&team=Kaizer%20Chiefs&source=GNews`
- `GET /api/news/:id`
- `GET /api/news/search?q=kaizer`
- `GET /api/news/category/:category`
- `GET /api/teams/:team/news`
- `GET /api/categories`
- `GET /api/sources`
- `GET /api/teams`
- `GET /api/docs`

## Sync News

Run a manual sync:

```bash
npm run sync
```

Scheduled sync runs while the server is running when `NEWS_SYNC_ENABLED=true` and `GNEWS_API_KEY` is configured.

## Docker

```bash
docker compose up --build
```

Then run migrations and seed data inside the API container if needed:

```bash
docker compose exec api npm run migrate
docker compose exec api npm run seed
```

## Notes On Data Sources

The API does not scrape publishers directly. It stores article metadata delivered by configured providers, then serves Touchline from the local database so the UI automatically reflects database changes.

## Validation

```bash
npm run build
npm test
```
