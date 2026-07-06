from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from rich import panel, print
from scalar_fastapi import get_scalar_api_reference

from app.api.router import master
from app.database.session import create_database_tables


@asynccontextmanager
async def lifespan_handler(app: FastAPI):
    # Marking the starting of the server
    print(panel.Panel("Server has started", border_style="green"))

    # Creating the database tables on server startup
    await create_database_tables()

    # Creating base directory for all courses
    courses = Path("storage/courses")
    courses.mkdir(parents=True, exist_ok=True)

    yield

    # Marking the stop or termination of the server
    print(panel.Panel("Server has ended", border_style="red"))

# Initializing the app
app = FastAPI(
    # Server start/stop listener
    lifespan=lifespan_handler,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Including the all Endpoints routes
app.include_router(master)

# Scalar Documentation
@app.get("/scalar", include_in_schema=False)
def get_scalar_docs():
    return get_scalar_api_reference(
        openapi_url=app.openapi_url,
        title="Scalar API",
    )