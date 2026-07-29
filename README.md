# Touchline Sync Merged Project

This folder now holds the merged backend and frontend.

What is included:
- Backend API in `app/`
- Database schema and migrations in `db/`
- Frontend app in `frontend/`
- Shared helper scripts and documentation

Main entry points:
- `app/main.py` for the API
- `db/touchlinedb.sql` for the full schema
- `frontend/src/main.tsx` for the UI
- `frontend/vite.config.ts` for the frontend dev server

Run notes:
- Copy `frontend/.env.example` to `frontend/.env` and fill in the frontend values
- Copy the root `.env.example` to `.env` and fill in backend values
- Start the backend from the project root
- Start the frontend from `frontend/`
