"""Sidecar configuration via pydantic-settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    wolfram_app_id: str = ""
    anthropic_api_key: str = ""
    dspy_cache_dir: str = "/tmp/dspy_cache"
    dspy_model: str = ""
    dspy_api_key: str = ""
    dspy_api_base: str = ""
    langchain_model: str = ""
    langchain_api_key: str = ""
    langchain_api_base: str = ""
    langsmith_api_key: str = ""
    langsmith_project: str = "mathviz-sidecar"
    langsmith_tracing: bool = False
    scientific_timeout_seconds: int = 30
    sidecar_port: int = 8100

    class Config:
        env_prefix = "MATHVIZ_"
        env_file = ".env.local"


settings = Settings()
