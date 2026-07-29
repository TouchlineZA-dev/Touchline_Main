"""Smoke-test the configured football news providers."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.news_service import sa_news_client


async def main() -> int:
    response = await sa_news_client.get_headlines(max_results=6, db=None)
    print(f"articles={len(response.articles)}")
    for article in response.articles:
        print(f"- {article.source.name}: {article.title[:90]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
