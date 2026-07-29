"""Check what schemas and tables exist in the database."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from scripts.sync_external_apis import load_dotenv, make_engine
from sqlalchemy import text

load_dotenv()
engine = make_engine()
with engine.connect() as conn:
    print("=== Schemas ===")
    rows = conn.execute(text("SELECT schema_name FROM information_schema.schemata ORDER BY schema_name"))
    for r in rows:
        print(f"  {r[0]}")

    print("\n=== Tables (app, football, fantasy, public) ===")
    rows = conn.execute(text(
        "SELECT table_schema, table_name FROM information_schema.tables "
        "WHERE table_schema IN ('public','app','football','fantasy') "
        "ORDER BY table_schema, table_name"
    ))
    for r in rows:
        print(f"  {r[0]}.{r[1]}")
