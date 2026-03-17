from fastapi import APIRouter
from app.api.v1 import auth, users, courses, content, assessments, grades, messaging, notifications, analytics, tenants, attendance

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(courses.router)
api_router.include_router(content.router)
api_router.include_router(assessments.router)
api_router.include_router(grades.router)
api_router.include_router(messaging.router)
api_router.include_router(notifications.router)
api_router.include_router(analytics.router)
api_router.include_router(tenants.router)
api_router.include_router(attendance.router)
