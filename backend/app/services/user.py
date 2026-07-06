import os
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

import app.core.exceptions as Error
import app.database.models as models
from app.api.schemas.user import ProfileUpdate, UserRead


class UserService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def _get_user(self, user_id: str, role: str) -> tuple[models.User, models.Roles]:
        # Setting the user role
        role_enum = models.Roles(role)
        model_map = {
            models.Roles.student: models.Student,
            models.Roles.instructor: models.Instructor,
            models.Roles.administrator: models.Administrator,
        }

        # Getting user from database
        user = await self.session.get(model_map[role_enum], UUID(user_id))

        # If user not found
        if not user:
            raise Error.UserNotFoundError(user_id)
        
        # Returning user and he/her role
        return user, role_enum

    async def get_profile(self, user_id: str, role: str) -> UserRead:
        # Getting user and role from database
        user, role_enum = await self._get_user(user_id, role)

        # Returning user info
        return UserRead(**user.model_dump(), role=role_enum)

    async def update_profile(self, user_id: str, role: str, data: ProfileUpdate) -> UserRead:
        # Getting user and role from database
        user, role_enum = await self._get_user(user_id, role)

        # Updating the user data with new input data
        update_data = data.model_dump(exclude_none=True)
        if update_data:
            # Updating the user in database
            user.sqlmodel_update(update_data)

            # Applying changes
            await self.session.commit()

            # Getting user info
            await self.session.refresh(user)
        
        # Returning user info
        return UserRead(**user.model_dump(), role=role_enum)

    async def update_avatar(self, user_id: str, role: str, file: UploadFile) -> None:
        # Getting user from database
        user, _ = await self._get_user(user_id, role)

        # If no avatar was uploaded
        if not file.filename:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file uploaded")

        # Getting file extension
        extension = Path(file.filename).suffix.lower()

        # Allowed file formats
        allowed_extensions = [".jpg", ".jpeg", ".png"]
        allowed_content_types = ["image/jpeg", "image/jpg", "image/png"]

        # If file format is not supported
        if extension not in allowed_extensions or file.content_type not in allowed_content_types:
            raise Error.InvalidFileFormatError(extension)

        # If file size is too big
        if file.size and file.size > 5 * 1024 * 1024:
            raise Error.FileSizeTooLarge(5 * 1024 * 1024)

        # Deleing the old avatar if exists
        if user.avatar_url:
            old_path = Path(user.avatar_url)
            if old_path.exists():
                os.remove(old_path)

        # Creating the avatar directory
        avatar_dir = Path(f"storage/users/{user_id}/avatar")
        avatar_dir.mkdir(parents=True, exist_ok=True)
        
        # Saving file into storage
        file_path = avatar_dir / f"avatar{extension}"
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        # Updating the file url in database
        user.avatar_url = str(file_path)

        # Applying changes
        await self.session.commit()

    async def delete_avatar(self, user_id: str, role: str) -> None:
        # Getting user from database
        user, _ = await self._get_user(user_id, role)

        # If avatar file does not exist
        if not user.avatar_url:
            raise Error.NoFileUploadedError()

        # Getting the path of the file
        file_path = Path(user.avatar_url)

        # Deleting file from storage
        if file_path.exists():
            os.remove(file_path)

        # Updating the url in database to null
        user.avatar_url = None

        # Applying changes
        await self.session.commit()
