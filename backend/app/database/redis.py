from datetime import datetime, timezone

from redis.asyncio import Redis

from app.config import db_settings

# Using Redis db=0 for JWT token blacklist
_token_black_list = Redis(
    host=db_settings.REDIS_HOST,
    port=db_settings.REDIS_PORT,
    db=0
)

async def is_jti_blacklisted(jti: str) -> bool:
    # Checking if the token in blacklist
    return await _token_black_list.exists(jti)

async def add_to_blacklist(token: dict):
    # Calculating the TTL (Time To Live)
    current_time = int(datetime.now(timezone.utc).timestamp())

    ttl_seconds = token["exp"] - current_time

    # String token in blacklist with TTL so Redis can auto delete tokens
    return await _token_black_list.set(token["jti"], "blacklisted", ex=ttl_seconds)