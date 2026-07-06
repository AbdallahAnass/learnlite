from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
from fastapi import HTTPException, status
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.schemas.user import UserRead
from app.config import security_settings
from app.database.models import Administrator, Instructor, Roles, Student
from app.database.redis import add_to_blacklist

from ..api.schemas.user import UserCreate
from ..core.exceptions import (
    AdminAccountCreationError,
    InvalidCredentialsError,
    UserAlreadyExistsError,
)

# Password Context
password_context = CryptContext(schemes=["argon2"], deprecated="auto")

class AuthService:
    def __init__(self, session: AsyncSession):
        # Getting the database session
        self.session = session
    
    async def register_user(self, credentials: UserCreate) -> UserRead:
        # Searching for duplicated email
        result = await self.get_user_by_email(credentials.email)
        if result is not None:
                raise UserAlreadyExistsError(credentials.email)
        
        # Preventing admin accounts creation
        if credentials.role == Roles.administrator:
            raise AdminAccountCreationError()

        # Creating a user model with provided credentials
        user = self.create_user_model(credentials)

        # Saving the new user in the database
        self.session.add(user)
        await self.session.commit()

        # Getting user info database
        await self.session.refresh(user)

        # Returning the user info
        return UserRead(
            **user.model_dump(), 
            role=credentials.role
        )
    
    async def get_user_by_email(self, email: str) -> dict | None:
        # Searching the Student table
        student_search_query = select(Student).where(Student.email == email)
        student_result = await self.session.execute(student_search_query)
        student = student_result.scalar_one_or_none()

        if student:
            return {
                "entity": student,
                "role": Roles.student
            }

        # Searching the Instructor table
        instructor_search_query = select(Instructor).where(Instructor.email == email)
        instructor_result = await self.session.execute(instructor_search_query)
        instructor = instructor_result.scalar_one_or_none()

        if instructor:
            return {
                "entity": instructor,
                "role": Roles.instructor
            }

        # Searching the Administrator table
        admin_search_query = select(Administrator).where(Administrator.email == email)
        admin_result = await self.session.execute(admin_search_query)
        admin = admin_result.scalar_one_or_none()

        if admin:
            return {
                "entity": admin,
                "role": Roles.administrator
            }
        
        # No matching email found
        return None

        
    def create_user_model(self, credentials: UserCreate):
        # Creating a user model with provided credentials based on the rule
        if credentials.role == Roles.student:
            return Student(
                **credentials.model_dump(exclude={"password"}),

                # Hashing password
                password_hash=password_context.hash(credentials.password)
            )

        elif credentials.role == Roles.instructor:
            return Instructor(
                **credentials.model_dump(exclude={"password"}),

                # Hashing password
                password_hash=password_context.hash(credentials.password)
            )

        elif credentials.role == Roles.administrator:
            return Administrator(
                **credentials.model_dump(exclude={"password"}),

                # Hashing password
                password_hash=password_context.hash(credentials.password)
            )


    async def authenticate_user(self, email: str, password:str) -> str:
        # Getting user using email from database
        result = await self.get_user_by_email(email)

        # Verifying that the user exist
        if not result:
            raise InvalidCredentialsError()
        
        # Extracting user info from result
        user = result["entity"]
        user_role = result["role"]

        # Verifying password
        if not password_context.verify(password, user.password_hash):
            raise InvalidCredentialsError()
        
        # Generating access token
        return self._generate_access_token(
            data={
                "user_id": str(user.id),
                "user_role": user_role
            }
        )
    
    @staticmethod
    def decode_token(token: str) -> dict:
        # Decoding the token
        try:
            return jwt.decode(
                    jwt=token,
                    key=security_settings.JWT_SECRET,
                    algorithms=[security_settings.JWT_ALGORITHM]
                )
        except jwt.ExpiredSignatureError: # Token has valid signature but past its expiration
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token Expired"
            )
        except jwt.InvalidTokenError: # Token signature invalid, malformed, or other validation failure
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token Invalid"
            )
    
    async def invalidate_user_token(self, token: dict):
        # Adding token to the blacklist in Redis
        await add_to_blacklist(token)
    
    def _generate_access_token(self, data: dict) -> str:
        # Returning the access token
        return jwt.encode(
            payload= {
                # Unpacking data
                **data,

                # Generating an id for the token
                "jti": str(uuid4()), 

                # Setting expiry date
                "exp": datetime.now(timezone.utc) + timedelta(days=7)

            },
            # Assigning the secret word
            key=security_settings.JWT_SECRET,

            # Assigning the algorithm used for encryption
            algorithm=security_settings.JWT_ALGORITHM
        )    
