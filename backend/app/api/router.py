from fastapi import APIRouter

from app.api.routers import (
    admin,
    ai,
    auth,
    courses,
    enrollment,
    instructor,
    quiz,
    review,
    users,
    wellness,
)

# Main router (Master)
master = APIRouter()

# Including the Authentication route
master.include_router(auth.route)

#Including courses route
master.include_router(courses.route)

# Including the instructor route
master.include_router(instructor.route)

# Including the enrollment route
master.include_router(enrollment.route)

# Including the quiz route
master.include_router(quiz.route)

# Including the admin route
master.include_router(admin.route)

# Including the AI route
master.include_router(ai.route)

# Including the users route
master.include_router(users.route)

# Including the wellness route
master.include_router(wellness.route)

# Including the reviews route
master.include_router(review.route)