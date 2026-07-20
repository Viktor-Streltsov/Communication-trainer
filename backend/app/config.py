from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # LLM provider name (informational; switching provider = change base_url + model)
    # Groq is the default: free tier, no credit card, OpenAI-compatible format.
    # To switch: set llm_provider / llm_api_base_url / llm_model in .env.
    llm_provider: str = "groq"

    llm_api_key: str
    llm_model: str = "llama-3.3-70b-versatile"
    llm_api_base_url: str = "https://api.groq.com/openai/v1"

    # Database
    # Uses psycopg3 driver (compatible with Python 3.12+ on Windows).
    # Same dialect "psycopg" works for both sync (Alembic) and async (FastAPI).
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5433/communication_trainer"

    # App
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:8100"]

    # Email (Resend — https://resend.com, free tier, no card required)
    resend_api_key: str = ""
    resend_from_email: str = "noreply@resend.dev"

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 30  # 30 days


settings = Settings()
