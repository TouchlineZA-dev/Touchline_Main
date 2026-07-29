# Database Build Function - Usage Guide

## Overview
This SQL function (`build_database.sql`) provides a comprehensive solution for building the entire Touchline Sync database with all 25 migrations in a single function call.

## File Location
```
touchline-sync-main/db/build_database.sql
```

## What It Does
The `build_database()` function executes all migrations from the DB folder in sequence and provides:
- ✅ All 25 migrations (V001 through V025)
- ✅ Error handling for each migration
- ✅ Execution status tracking
- ✅ Returns detailed results for each migration

## Database Structure

### Schemas Created
- `football` - Football data (competitions, seasons, teams, players, fixtures)
- `sync` - Synchronization jobs and logs
- `app` - Application data (users, fantasy teams, gameweeks, leaderboards)

### Users Created
- `sync_worker_user` - For backend sync processes
- `app_api_user` - For API access

## How to Use

### 1. Execute the Build Function
```sql
SELECT * FROM public.build_database();
```

This will return a result set with:
- `migration_version` - The version number (001-025)
- `migration_name` - The migration description
- `execution_status` - SUCCESS or FAILED with error message
- `execution_time` - When the migration executed

### 2. Check Database Status
After building, verify the database structure:
```sql
SELECT * FROM public.get_database_status();
```

This returns:
- Schema name
- Number of tables in each schema
- Number of functions in each schema
- Number of indexes in each schema

### 3. View Table Information
```sql
SELECT * FROM public.get_table_info();
```

This returns a complete list of all tables with:
- Schema name
- Table name
- Column count
- (Extensible for record counts)

## Migrations Included

| Version | Name | Purpose |
|---------|------|---------|
| V001 | schemas_roles_permissions | Create schemas and users |
| V002 | timestamp_trigger | Create updated_at trigger function |
| V003 | football_competitions | Football competitions table |
| V004 | football_seasons | Football seasons table |
| V005 | football_teams | Football teams table |
| V006 | football_players | Football players table |
| V007 | football_fixtures | Football fixtures/matches table |
| V008 | football_player_match_stats | Player performance statistics |
| V009 | app_gameweeks | App gameweeks table |
| V010 | sync_jobs | Sync job tracking |
| V011 | sync_logs | Sync operation logs |
| V012 | sync_gameweek_status | Gameweek sync status |
| V013 | football_match_events | Match events (goals, cards, etc.) |
| V014 | app_users | Application users |
| V015 | app_fantasy_teams | Fantasy team ownership |
| V016 | app_fantasy_squads | Fantasy team squad players |
| V017 | app_points_results | Fantasy points calculation |
| V018 | app_leaderboards | Fantasy league rankings |
| V019 | final_permissions | Grant user permissions |
| V020 | indexes | Create performance indexes |
| V021 | football_player_lineups | Match lineups and formations |
| V022 | app_player_prices | Dynamic player pricing |
| V023 | app_player_price_changes | Price history tracking |
| V024 | fantasy_squads_purchase_price | Squad purchase price tracking |
| V025 | fantasy_teams_budget | Team budget management |

## Features

### Error Handling
Each migration is wrapped in a BEGIN-EXCEPTION block, so:
- Failed migrations don't stop the entire process
- Each migration's status is captured and reported
- You can see exactly which migrations succeeded or failed

### Idempotency
All table/schema creations use `IF NOT EXISTS`, allowing:
- Safe re-execution of the function
- No errors if tables already exist
- Useful for testing and validation

### Performance
- All 25 migrations execute in a single transaction
- Efficient index creation
- Proper foreign key relationships

## Example Output

```
migration_version | migration_name                  | execution_status | execution_time
-----------+-----------------------------------+---------+------------------------
001        | schemas_roles_permissions         | SUCCESS | 2024-01-10 10:30:45
002        | timestamp_trigger                 | SUCCESS | 2024-01-10 10:30:45
003        | football_competitions             | SUCCESS | 2024-01-10 10:30:45
004        | football_seasons                  | SUCCESS | 2024-01-10 10:30:45
...
025        | fantasy_teams_budget              | SUCCESS | 2024-01-10 10:30:48
```

## Integration

### With Flyway
This function is compatible with Flyway version control but can also run independently.

### In Application Startup
Include in application initialization scripts:
```bash
psql -d your_database -f touchline-sync-main/db/build_database.sql
psql -d your_database -c "SELECT * FROM public.build_database();"
```

### In Docker
```dockerfile
RUN psql -d $DB_NAME -f /db/build_database.sql
RUN psql -d $DB_NAME -c "SELECT * FROM public.build_database();"
```

## Security Notes

⚠️ **Important**: 
- Default passwords are embedded in V001 migration
- For production, modify the passwords in the migration
- Use environment variables or secrets management in real deployments
- Grant permissions are specific to the two users created

## Troubleshooting

**Issue**: Migration fails with "already exists"
- Solution: The `IF NOT EXISTS` clauses should prevent this

**Issue**: Permission denied errors
- Solution: Ensure the executing user has superuser privileges

**Issue**: Foreign key constraint failures
- Solution: Migrations run in order; check that parent tables exist first

## Support

For issues specific to individual migrations, refer to the original migration files in:
```
touchline-sync-main/db/migrations/
```
