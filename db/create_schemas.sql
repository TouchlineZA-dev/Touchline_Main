-- ============================================================================
-- CREATE SCHEMAS FIRST
-- Run this BEFORE creating any tables
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS football;
CREATE SCHEMA IF NOT EXISTS sync;
CREATE SCHEMA IF NOT EXISTS app;

-- Verify schemas were created
SELECT schema_name FROM information_schema.schemata 
WHERE schema_name IN ('football', 'sync', 'app');
