from fastapi.security import OAuth2PasswordBearer

# OAuth2 Schema for tokens
oAuth2_schema = OAuth2PasswordBearer(tokenUrl="/auth/login")