# Touchline API

This is the first ASP.NET Core API project for Touchline. It is separated from
the React source by folder and project boundary, and follows the service
architecture in the repository-root `IMPLEMENTATION_PLAN.md`.

## Run locally

From this directory:

```powershell
dotnet restore .\Touchline.Api\Touchline.Api.csproj --configfile .\Touchline.Api\NuGet.Config
dotnet run --project .\Touchline.Api\Touchline.Api.csproj
```

Health endpoint: `http://localhost:5080/api/v1/health`.
The project includes editable `.http` requests in `Touchline.Api/Touchline.Api.http`.

Set local secrets with .NET user-secrets (do not put the service-role key in
the React `.env` file):

```powershell
dotnet user-secrets --project .\Touchline.Api\Touchline.Api.csproj set "Supabase:Url" "https://YOUR_PROJECT.supabase.co"
dotnet user-secrets --project .\Touchline.Api\Touchline.Api.csproj set "Supabase:AnonKey" "YOUR_SUPABASE_PUBLIC_KEY"
dotnet user-secrets --project .\Touchline.Api\Touchline.Api.csproj set "Supabase:ServiceRoleKey" "YOUR_SERVER_ONLY_SERVICE_ROLE_KEY"
```

The current workspace has no Supabase credentials configured. Health works
without them; data routes require the settings above and the fantasy schema
contract in `Database/FantasySchemaProposal.sql` to be reviewed and applied
through the database migration owner's repository.

The frontend can be opened separately at `http://127.0.0.1:8080/`. It is not
yet switched to this API: fixtures, news, standings, match details, and the
Supabase sign-in UI still need migration/integration.

## Current routes

- `GET /api/v1/health` — process health, no database call.
- `GET /api/v1/players` — current PSL players, positions, club association,
  prices, and existing deterministic card attributes.
- `GET /api/v1/fantasy/team` — signed-in user's current-season team.
- `PUT /api/v1/fantasy/team` — save a squad after server validation and the
  database's transactional validation.
- `POST /api/v1/fantasy/chip` — activate one chip for the current gameweek.
- `GET /api/v1/fantasy/teams/{authUserId}` — current-season team view.
- `GET|POST /api/v1/fantasy/leagues` — list or create leagues.
- `POST /api/v1/fantasy/leagues/join` — join by invite code.
- `GET /api/v1/fantasy/leagues/{id}` — league members (members only).
- `GET /api/v1/fantasy/leagues/{id}/standings?gameweek=4` — weekly standings;
  omit `gameweek` for overall standings.

Fantasy routes require a Supabase access token in the `Authorization: Bearer`
header. The API verifies the token with Supabase Auth and gets the acting user
ID from that verified identity. CORS origins are configured under
`Frontend:AllowedOrigins`.

## Project layout

- `Controllers/` — HTTP request/response handling only.
- `Services/` — fantasy squad rules, scoring, season lookup, and league actions.
- `Models/` — validated API request and scoring models.
- `Infrastructure/` — Supabase Auth validation and server-side PostgREST access.
- `Middleware/` — auth boundary for fantasy routes and safe exception responses.
- `Database/` — clearly labeled draft schema proposal, to be reviewed and
  migrated only by the canonical database owner.

Fantasy scoring calculation is present as a service. A trusted worker/API job
that reads only completed, valid match events and persists team/gameweek totals
is still to be implemented. The React login flow must also be connected to
Supabase Auth before authenticated fantasy routes can be exercised end to end.

The API currently lives as a `Touchline API/` folder inside the frontend
repository checkout. It is not yet a separate Git repository. Move or split
this folder into the dedicated backend repository once the team identifies or
creates that repository. Database migrations remain owned by the sync/database
repository. The proposal under `Database/` must be reviewed there before use.
