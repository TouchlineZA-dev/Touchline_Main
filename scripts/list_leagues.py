"""List all leagues available on the Sportsmonks subscription."""
import httpx, os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from scripts.sync_external_apis import load_dotenv, env

load_dotenv()
token = env("SPORTMONKS_API_KEY")

# Try listing all leagues (not search)
r = httpx.get(
    "https://api.sportmonks.com/v3/football/leagues",
    params={"api_token": token, "per_page": 50},
    timeout=30,
)
print(f"Status: {r.status_code}")
data = r.json()
leagues = data.get("data", [])
print(f"Leagues returned: {len(leagues)}")
for lg in leagues:
    print(f"  id={lg.get('id')}, name={lg.get('name')}, country_id={lg.get('country_id')}, active={lg.get('active')}")

if not leagues:
    print("\nFull response:")
    print(json.dumps(data, indent=2)[:2000])

# Also try searching for various names
for q in ["Premier Soccer League", "PSL", "Betway", "South Africa", "Premier League"]:
    r2 = httpx.get(
        f"https://api.sportmonks.com/v3/football/leagues/search/{q}",
        params={"api_token": token},
        timeout=30,
    )
    d2 = r2.json().get("data", [])
    print(f"\nSearch '{q}': {len(d2)} results")
    for lg in d2[:3]:
        print(f"  id={lg.get('id')}, name={lg.get('name')}")
