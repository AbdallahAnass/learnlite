from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

import app.core.exceptions as Error
from app.api.dependencies import UserServiceDep, any_active_user
from app.api.schemas.user import ProfileUpdate, UserRead

route = APIRouter(prefix="/users", tags=["Users"])


@route.get("/me", response_model=UserRead, status_code=status.HTTP_200_OK)
async def get_profile(user: any_active_user, UserService: UserServiceDep) -> UserRead:
    try:
        # Getting user profile
        return await UserService.get_profile(user["user_id"], user["user_role"])
    
    except Error.UserNotFoundError as e: # If user not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=e.message
        )

@route.put("/me", response_model=UserRead, status_code=status.HTTP_200_OK)
async def update_profile(data: ProfileUpdate, user: any_active_user, UserService: UserServiceDep) -> UserRead:
    try:
        # Updating user profile
        return await UserService.update_profile(user["user_id"], user["user_role"], data)

    except Error.UserNotFoundError as e: # If user not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=e.message
        )

@route.get("/me/avatar", status_code=status.HTTP_200_OK)
async def get_avatar(user: any_active_user, UserService: UserServiceDep) -> FileResponse:
    # Getting user profile
    profile = await UserService.get_profile(user["user_id"], user["user_role"])

    # uf user avatar url not found
    if not profile.avatar_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="No avatar uploaded"
        )
    
    # Returning the avatar file
    return FileResponse(profile.avatar_url)


@route.post("/me/avatar", response_model=dict[str, str], status_code=status.HTTP_200_OK)
async def upload_avatar(user: any_active_user, UserService: UserServiceDep, file: UploadFile = File(...)) -> dict[str, str]:
    try:
        # Updating avatar
        await UserService.update_avatar(user["user_id"], user["user_role"], file)
    
    except Error.InvalidFileFormatError as e: # If file format is not supported
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=e.message
        )
    
    except Error.FileSizeTooLarge as e: # If file is too large
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=e.message
        )
    
    except Error.UserNotFoundError as e: # If user not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=e.message
        )
    
    # Returning a success message
    return {"message": "Avatar updated successfully"}


@route.delete("/me/avatar", response_model=dict[str, str], status_code=status.HTTP_200_OK)
async def delete_avatar(user: any_active_user, UserService: UserServiceDep) -> dict[str, str]:
    try:
        # Deleting user avatar
        await UserService.delete_avatar(user["user_id"], user["user_role"])
    
    except Error.UserNotFoundError as e: # If user not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=e.message
        )

    except Error.NoFileUploadedError as e: # If no file was uploaded
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=e.message
        )

    # Returning a success message
    return {"message": "Avatar deleted successfully"}
