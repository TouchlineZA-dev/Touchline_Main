# Fantasy API contract and implementation locations

> **Architecture note:** The target is a C# ASP.NET Touchline API. Its initial
> implementation lives in `Touchline API/Touchline.Api/`. The Netlify function
> in this frontend folder is a prototype; keep production logic in ASP.NET.

The ASP.NET API verifies `Authorization: Bearer <Supabase access token>` with
Supabase Auth and derives the user ID from that verified token; it does not
trust a user ID supplied in a request body. The current API folder is still in
the same Git repository as the frontend and needs a dedicated backend repo.

## Routes

| Method and path | Purpose |
| --- | --- |
| `GET /api/v1/fantasy/team` | Load the signed-in user's team for the current PSL season. |
| `PUT /api/v1/fantasy/team` | Create or replace the user's 15-player squad. Server validates player prices, positions, budget, formation, slots, captain assignments, and the three-player club limit in one database transaction. |
| `POST /api/v1/fantasy/chip` | Activate Bench Boost, Triple Captain, or Wildcard. A second chip cannot be active until the scoring/gameweek process clears the current chip. |
| `GET /api/v1/fantasy/teams/:authUserId` | View another signed-in user's current-season team and picks. |
| `GET /api/v1/fantasy/leagues` | List the signed-in user's current-season leagues. The join code is returned only to its owner. |
| `POST /api/v1/fantasy/leagues` | Create a league. The creator must already have a fantasy team. |
| `POST /api/v1/fantasy/leagues/join` | Join by `{ "code": "AB12CD34" }`. Server enforces uniqueness and the 20-member limit under a row lock. |
| `GET /api/v1/fantasy/leagues/:id` | View league members. Only members can access it. |
| `GET /api/v1/fantasy/leagues/:id/standings` | Overall standings. |
| `GET /api/v1/fantasy/leagues/:id/standings?gameweek=4` | Weekly standings, sourced from `app.fantasy_gameweek_scores`. |

## Save a team

`PUT /api/v1/fantasy/team` body:

```json
{
  "teamName": "Khanya's XI",
  "formation": "4-4-2",
  "picks": [
    {
      "playerId": 123,
      "slot": 0,
      "isCaptain": false,
      "isViceCaptain": false,
      "isBench": false
    }
  ]
}
```

The `picks` array must contain all 15 players. Slots 0–10 are starters; slots
11–14 are the bench. Player positions and prices are read from the database.
The API uses the latest player lineup in the current season to determine each
player's club, matching the existing `/api/v1/players` endpoint.

## Configuration and database prerequisites

The schema draft lives at `../Touchline API/Database/FantasySchemaProposal.sql`.
It is not the canonical migration and must be reviewed in the database
migration owner's repository before use. The app's current browser-only
sign-in does not provide the Supabase token required to call the fantasy API.

Gameweek scoring is intentionally a separate integration: the scoring worker
must populate `app.fantasy_gameweek_scores` and update team totals. Until that
work is connected, the API can save teams and manage leagues, but leaderboard
points will remain at their stored/default values.
