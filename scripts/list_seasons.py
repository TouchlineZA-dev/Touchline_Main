"""List seasons for league 806 (SA Premier League)."""
import httpx, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from scripts.sync_external_apis import load_dotenv, env

load_dotenv()
token = env("SPORTMONKS_API_KEY")

# List seasons directly for league 806
r = httpx.get(
    "https://api.sportmonks.com/v3/football/seasons",
    params={"api_token": token, "per_page": 50, "filters": "seasonLeagues:806"},
    timeout=30,
)
print(f"Status: {r.status_code}")
data = r.json()
seasons = data.get("data", [])
print(f"Seasons returned: {len(seasons)}")
for s in seasons:
    print(f"  id={s.get('id')}, name={s.get('name')}, league_id={s.get('league_id')}, is_current={s.get('is_current')}, starting_at={s.get('starting_at')}, ending_at={s.get('ending_at')}")

# Also try search with just "2025"
for q in ["2025", "2024", "2025-2026"]:
    r2 = httpx.get(
        f"https://api.sportmonks.com/v3/football/seasons/search/{q}",
        params={"api_token": token, "filters": "seasonLeagues:806"},
        timeout=30,
    )
    d2 = r2.json().get("data", [])
    print(f"\nSearch '{q}': {len(d2)} results")
    for s in d2[:5]:
        print(f"  id={s.get('id')}, name={s.get('name')}, is_current={s.get('is_current')}")
