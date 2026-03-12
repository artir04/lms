from celery import Celery
from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "lms",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.tasks.notifications", "app.workers.tasks.analytics"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "nightly-analytics": {
            "task": "app.workers.tasks.analytics.generate_nightly_snapshots",
            "schedule": 86400.0,  # daily
        },
    },
)
