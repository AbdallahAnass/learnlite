from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel

from app.config import db_settings

# Creating the engine to connect to the database
engine = create_async_engine(
    url=db_settings.POSTGRES_URL,
    # Log of sql queries
    echo=True,
)

# Initializing tables
async def create_database_tables():
    async with engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)

# Creating the session connection
async def get_session():
    async_session = sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    # Providing the connection sessions
    async with async_session() as session:
        yield session