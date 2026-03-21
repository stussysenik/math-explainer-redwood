"""Sidecar configuration via pydantic-settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    wolfram_app_id: str = ""
    anthropic_api_key: str = ""
    dspy_cache_dir: str = "/tmp/dspy_cache"
    sidecar_port: int = 8100

    class Config:
        env_prefix = "MATHVIZ_"
        env_file = ".env.local"


settings = Settings()
