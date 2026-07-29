from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    neon_admin_url: str = ""
    database_url: str = ""
    sportmonks_api_key: str = ""
    sportmonks_base_url: str = "https://api.sportmonks.com/v3/football"

    # GNews API - South African football news
    gnews_api_key: str = ""
    gnews_base_url: str = "https://gnews.io/api/v4"
    gnews_cache_ttl_minutes: int = 30
    # Optional alternative news provider (NewsAPI.ai) to supplement GNews
    newsapi_ai_api_key: str = ""
    newsapi_ai_base_url: str = "https://eventregistry.org/api/v1"


settings: Settings = Settings()
