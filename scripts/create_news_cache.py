"""Create the app.news_cache table and run the sync."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from scripts.sync_external_apis import load_dotenv, make_engine
from sqlalchemy import text

load_dotenv()
engine = make_engine()

# Create news_cache table
with engine.begin() as conn:
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS app.news_cache (
            id          SERIAL       PRIMARY KEY,
            cache_key   VARCHAR(255) NOT NULL UNIQUE,
            response    JSONB        NOT NULL,
            fetched_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            expires_at  TIMESTAMPTZ  NOT NULL
        )
    """))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_news_cache_key     ON app.news_cache(cache_key)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_news_cache_expires ON app.news_cache(expires_at)"))
    print("Created app.news_cache table successfully.")
