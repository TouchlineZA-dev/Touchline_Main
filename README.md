# Touchline

Frontend for the Touchline fantasy football platform.
change to make 

## What is in this repo

- `frontend/` — the Vite + React + TypeScript web app (Tailwind + shadcn/ui)
- `frontend/android/` — Capacitor Android wrapper
- `frontend/netlify/` — Netlify build config and functions

## What is *not* in this repo

- **Database schema and migrations** live in the sync worker repo. That repo's
  `db/migrations/` is the single source of truth — do not keep a second copy here.
- **The sync worker** (Sportmonks + GNews ingestion into the `football` and `sync`
  schemas) lives in the sync worker repo.
- **The user-facing backend** (users, fantasy teams, scoring, leaderboards) lives
  in the backend repo. The frontend talks to it over HTTP; it never connects to
  the database directly.

See `BACKEND_INTEGRATION.md` for the shared database contract — schema ownership,
the Sportmonks id-space join rule, and the event/state codes.

## Running the frontend

```bash
cd frontend
npm install
cp .env.example .env   # then fill in the values
npm run dev
```

Other scripts: `npm run build`, `npm run preview`, `npm run lint`.

## Configuration

All configuration is in `frontend/.env` — see `frontend/.env.example`.
`VITE_API_BASE_URL` points at the backend API.
