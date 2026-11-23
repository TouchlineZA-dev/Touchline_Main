# Touchline

Frontend for the Touchline fantasy football platform.
change to make 

## What is in this repo

- `frontend/` — the Vite + React + TypeScript web app (Tailwind + shadcn/ui)
- `frontend/android/` — Capacitor Android wrapper
- `frontend/netlify/` — Netlify build config and functions
- `Touchline API/` — initial ASP.NET Core API project, currently colocated in
  this Git checkout and intended to move to its own backend repository

## What is *not* in this repo

- **Database schema and migrations** live in the sync worker repo. That repo's
  `db/migrations/` is the single source of truth — do not keep a second copy here.
- **The sync worker** (Sportmonks + GNews ingestion into the `football` and `sync`
  schemas) lives in the sync worker repo.
- **The Python sync worker** and its database migrations are in their separate
  owning repository. The new ASP.NET folder is only the initial API project;
  team still needs to decide/supply its separate Git repository and deployment.
- The frontend target is to talk to the ASP.NET API over HTTP. The current
  frontend still has legacy Netlify functions and local-only auth to migrate.

See `BACKEND_INTEGRATION.md` for the shared database contract — schema ownership,
the Sportmonks id-space join rule, and the event/state codes.

See [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) for the target architecture
from the Touchline architecture diagram, the fantasy API contract, and the
remaining implementation work.

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
