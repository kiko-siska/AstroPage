from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    app_debug: bool = False
    port: int = 8000
    secret_key: str = "change-me-in-production"

    # Database (async driver)
    database_url: str = "postgresql+asyncpg://astropage:astropage@localhost:5432/astropage"

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_ttl_minutes: int = 60 * 12  # 12h
    # Fernet key for encrypting EduPage session cookies at rest.
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    fernet_key: str = ""

    # CORS: the React frontend origin allowed to call this API.
    frontend_origin: str = "http://localhost:5173"

    # Optional: set to enable the example agent endpoint
    anthropic_api_key: str = ""

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


settings = Settings()
