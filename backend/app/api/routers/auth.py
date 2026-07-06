from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.exceptions import (
    AdminAccountCreationError,
    InvalidCredentialsError,
    UserAlreadyExistsError,
)

from ..dependencies import AuthServiceDep, any_active_user, get_user_access_token
from ..schemas.user import UserCreate, UserRead

# Initializing the route
route = APIRouter(prefix="/auth", tags=["Authentication"])

@route.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate, Authservice: AuthServiceDep)-> UserRead:
    # Registering the user
    try:
        created_user = await Authservice.register_user(user)

    except UserAlreadyExistsError as e: # If user email already exists
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail= e.message
        )
    except AdminAccountCreationError as e: # If user tries to register as an admin
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message
        )
    
    # Returning user info without password
    return created_user

@route.post("/login", response_model=dict[str, str])
async def login_user(request_form: Annotated[OAuth2PasswordRequestForm, Depends()], AuthService: AuthServiceDep) -> dict[str, str]:
    try:
        # Authenticating user and generating an access token
        token = await AuthService.authenticate_user(request_form.username, request_form.password)

    except InvalidCredentialsError as e: # If email or password are incorrect
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message
            )
    
    # Returning the token
    return {
        "access_token": token,
        "token_type": "bearer"
    }

@route.post("/logout", response_model=dict[str, str])
async def logout_user(_: any_active_user, AuthService: AuthServiceDep, token: Annotated[dict, Depends(get_user_access_token)]) -> dict[str, str]:
    # Invalidating the user token
    await AuthService.invalidate_user_token(token)

    # Returning success message
    return {
        "message": "Successfully logged out"
    }