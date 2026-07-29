"""
Smoke-test external API providers used by Touchline.

The script reads credentials from .env or the current environment and checks:
  - Sportsmonks Football API returns plausible South African football data.
  - GNews returns South African football news.

Secrets are never printed.
"""

from __future__ import annotations

import argparse
import asyncio
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SPORTMONKS_BASE_URL = "https://api.sportmonks.com/v3/football"
DEFAULT_GNEWS_BASE_URL = "https://gnews.io/api/v4"


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str


def load_dotenv() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def env(name: str, default: str | None = None) -> str | None:
    value = os.environ.get(name, default)
    if value is None:
        return None
    value = value.strip()
    return value or None


def item_names(items: list[dict[str, Any]], limit: int = 3) -> str:
    names = [str(item.get("name") or item.get("title") or "untitled") for item in items[:limit]]
    return ", ".join(names) if names else "no named items"


async def get_json(
    client: httpx.AsyncClient,
    url: str,
    params: dict[str, Any],
) -> tuple[int, dict[str, Any]]:
    response = await client.get(url, params=params)
    status_code = response.status_code
    response.raise_for_status()
    return status_code, response.json()


async def check_sportmonks(client: httpx.AsyncClient) -> list[CheckResult]:
    token = env("SPORTMONKS_API_KEY")
    if token is None:
        return [
            CheckResult(
                "Sportsmonks football data",
                False,
                "SPORTMONKS_API_KEY is missing. Add it to .env or your shell environment.",
            )
        ]

    base_url = env("SPORTMONKS_BASE_URL", DEFAULT_SPORTMONKS_BASE_URL).rstrip("/")
    params = {"api_token": token}
    results: list[CheckResult] = []

    checks = [
        (
            "Sportsmonks team search",
            f"{base_url}/teams/search/Orlando Pirates",
            "Orlando",
        ),
        (
            "Sportsmonks league search",
            f"{base_url}/leagues/search/Premier Soccer League",
            "Premier",
        ),
    ]

    for name, url, expected_text in checks:
        try:
            _, payload = await get_json(client, url, params)
        except httpx.HTTPStatusError as exc:
            results.append(
                CheckResult(
                    name,
                    False,
                    f"HTTP {exc.response.status_code} from {url}.",
                )
            )
            continue
        except httpx.HTTPError as exc:
            results.append(CheckResult(name, False, f"Request failed: {exc!s}"))
            continue

        data = payload.get("data")
        if not isinstance(data, list) or not data:
            results.append(CheckResult(name, False, "Response did not contain a non-empty data list."))
            continue

        names = item_names(data)
        expected_found = any(expected_text.lower() in str(item).lower() for item in data)
        if expected_found:
            results.append(CheckResult(name, True, f"Returned: {names}"))
        else:
            results.append(
                CheckResult(
                    name,
                    False,
                    f"Returned data, but did not clearly match '{expected_text}'. Sample: {names}",
                )
            )

    return results


async def check_gnews(client: httpx.AsyncClient) -> list[CheckResult]:
    token = env("GNEWS_API_KEY")
    if token is None:
        return [
            CheckResult(
                "GNews football news",
                False,
                "GNEWS_API_KEY is missing. Add it to .env or your shell environment.",
            )
        ]

    base_url = env("GNEWS_BASE_URL", DEFAULT_GNEWS_BASE_URL).rstrip("/")
    params = {
        "token": token,
        "q": "South Africa football PSL",
        "country": "za",
        "lang": "en",
        "max": 3,
    }

    try:
        _, payload = await get_json(client, f"{base_url}/search", params)
    except httpx.HTTPStatusError as exc:
        return [CheckResult("GNews football news", False, f"HTTP {exc.response.status_code} from GNews.")]
    except httpx.HTTPError as exc:
        return [CheckResult("GNews football news", False, f"Request failed: {exc!s}")]

    articles = payload.get("articles")
    if not isinstance(articles, list) or not articles:
        return [CheckResult("GNews football news", False, "Response did not contain a non-empty articles list.")]

    titles = item_names(articles)
    relevant = any(
        any(term in str(article).lower() for term in ("football", "psl", "bafana", "soccer"))
        for article in articles
    )
    if relevant:
        return [CheckResult("GNews football news", True, f"Returned: {titles}")]

    return [
        CheckResult(
            "GNews football news",
            False,
            f"Returned articles, but they did not clearly look football-related. Sample: {titles}",
        )
    ]


def print_results(results: list[CheckResult]) -> int:
    failures = 0
    for result in results:
        status = "PASS" if result.ok else "FAIL"
        print(f"[{status}] {result.name}: {result.detail}")
        if not result.ok:
            failures += 1
    return 1 if failures else 0


async def main() -> int:
    parser = argparse.ArgumentParser(description="Test Touchline external API providers.")
    parser.add_argument(
        "--provider",
        choices=("all", "sportmonks", "gnews"),
        default="all",
        help="Choose which provider to test.",
    )
    args = parser.parse_args()

    load_dotenv()

    timeout = httpx.Timeout(20.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        results: list[CheckResult] = []
        if args.provider in ("all", "sportmonks"):
            results.extend(await check_sportmonks(client))
        if args.provider in ("all", "gnews"):
            results.extend(await check_gnews(client))

    return print_results(results)


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
