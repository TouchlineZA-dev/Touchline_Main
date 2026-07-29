-- ============================================================================
-- COMPLETE DATABASE CLEANUP SCRIPT
-- WARNING: This will DELETE ALL tables, triggers, functions, and data
-- ============================================================================

-- Drop all tables in football, sync, and app schemas (cascade drops triggers)
DROP TABLE IF EXISTS app.player_price_changes CASCADE;
DROP TABLE IF EXISTS app.player_prices CASCADE;
DROP TABLE IF EXISTS app.points_results CASCADE;
DROP TABLE IF EXISTS app.leaderboards CASCADE;
DROP TABLE IF EXISTS app.fantasy_squads CASCADE;
DROP TABLE IF EXISTS app.fantasy_teams CASCADE;
DROP TABLE IF EXISTS app.users CASCADE;
DROP TABLE IF EXISTS app.gameweeks CASCADE;
DROP TABLE IF EXISTS sync.sync_gameweek_status CASCADE;
DROP TABLE IF EXISTS sync.sync_logs CASCADE;
DROP TABLE IF EXISTS sync.sync_jobs CASCADE;
DROP TABLE IF EXISTS football.player_lineups CASCADE;
DROP TABLE IF EXISTS football.match_events CASCADE;
DROP TABLE IF EXISTS football.player_match_stats CASCADE;
DROP TABLE IF EXISTS football.fixtures CASCADE;
DROP TABLE IF EXISTS football.players CASCADE;
DROP TABLE IF EXISTS football.teams CASCADE;
DROP TABLE IF EXISTS football.seasons CASCADE;
DROP TABLE IF EXISTS football.competitions CASCADE;

-- Drop trigger function
DROP FUNCTION IF EXISTS set_updated_at() CASCADE;

-- Drop helper functions
DROP FUNCTION IF EXISTS public.build_database() CASCADE;
DROP FUNCTION IF EXISTS public.build_database_tables() CASCADE;
DROP FUNCTION IF EXISTS public.get_database_status() CASCADE;
DROP FUNCTION IF EXISTS public.get_table_info() CASCADE;

-- Option 1: Keep schemas (recommended - just for next attempt)
-- TRUNCATE ALL TABLES IN SCHEMAS - schemas remain for reuse

-- Option 2: Drop schemas completely (full reset)
-- Uncomment the lines below ONLY if you want to delete the schemas too:
-- DROP SCHEMA IF EXISTS football CASCADE;
-- DROP SCHEMA IF EXISTS sync CASCADE;
-- DROP SCHEMA IF EXISTS app CASCADE;

-- Option 3: Drop users (uncomment if you want to remove them too)
-- Uncomment the lines below:
-- DROP USER IF EXISTS sync_worker_user;
-- DROP USER IF EXISTS app_api_user;

-- ============================================================================
-- VERIFICATION - Run this to confirm everything is deleted
-- ============================================================================
-- SELECT tablename FROM pg_tables WHERE schemaname IN ('football', 'sync', 'app');
-- (Should return no results if successful)
