from pydantic_settings import BaseSettings, SettingsConfigDict


# Database config class
class DatabaseSettings(BaseSettings):
    POSTGRES_SERVER: str
    POSTGRES_PORT: int
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str

    REDIS_HOST: str
    REDIS_PORT: int

    model_config = SettingsConfigDict(
        env_file="./.env",
        env_ignore_empty=True,
        extra="ignore"
    )

    @property
    def POSTGRES_URL(self):
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
# JWT security class
class SecuritySettings(BaseSettings):
    JWT_SECRET: str
    JWT_ALGORITHM: str

    model_config = SettingsConfigDict(
        env_file="./.env",
        env_ignore_empty=True,
        extra="ignore"
    )


class GroqSettings(BaseSettings):
    GROQ_API_KEY: str

    model_config = SettingsConfigDict(
        env_file="./.env",
        env_ignore_empty=True,
        extra="ignore"
    )


# Database settings
db_settings = DatabaseSettings() # type: ignore

# Security settings
security_settings = SecuritySettings() # type: ignore

# Groq settings
groq_settings = GroqSettings() # type: ignore