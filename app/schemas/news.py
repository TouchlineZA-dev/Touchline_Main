from pydantic import BaseModel


class GNewsSource(BaseModel):
    """The publication source of a news article."""

    name: str
    url: str


class GNewsArticle(BaseModel):
    """A single news article returned by GNews."""

    title: str
    description: str | None = None
    content: str | None = None
    url: str
    image: str | None = None
    publishedAt: str
    source: GNewsSource


class GNewsResponse(BaseModel):
    """Top-level response envelope from the GNews API."""

    totalArticles: int
    articles: list[GNewsArticle]
