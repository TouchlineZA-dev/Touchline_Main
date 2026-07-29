"""Smoke-test news provider fetch plus app.news_cache write/read."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal
from app.services.news_service import sa_news_client


async def main() -> int:
    if SessionLocal is None:
        raise RuntimeError("DATABASE_URL is missing; cannot test app.news_cache.")

    db = SessionLocal()
    try:
        first = await sa_news_client.get_headlines(max_results=6, db=db)
        second = await sa_news_client.get_headlines(max_results=6, db=db)
    finally:
        db.close()

    print(f"first_fetch_articles={len(first.articles)}")
    print(f"cached_fetch_articles={len(second.articles)}")
    for article in second.articles:
        print(f"- {article.source.name}: {article.title[:90]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
