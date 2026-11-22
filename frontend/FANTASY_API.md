# Fantasy API contract and current prototype

> **Architecture note:** The approved target is a C# ASP.NET Touchline API, as
> described in the repository-root `IMPLEMENTATION_PLAN.md`. The Netlify
> function in this frontend checkout is a prototype only. Port its contract
> and validation into the existing ASP.NET backend before production use.

The current prototype is a Netlify Function backed by Supabase. Every route requires
`Authorization: Bearer <Supabase access token>`. The function verifies the
token with Supabase Auth and derives the user ID from that verified token; it
does not trust a user ID supplied in a request body.

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

## Prototype prerequisites

The migration at `supabase/migrations/20261122090000_fantasy_api.sql` is a draft
in the wrong repository for production ownership. Review and move its schema
changes to the canonical migration repo before applying them. The app's current
browser-only sign-in does not provide the Supabase token required to call this
prototype.

Gameweek scoring is intentionally a separate integration: the scoring worker
must populate `app.fantasy_gameweek_scores` and update team totals. Until that
work is connected, the API can save teams and manage leagues, but leaderboard
points will remain at their stored/default values.
