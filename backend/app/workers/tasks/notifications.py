from app.workers.celery_app import celery_app
import logging

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.tasks.notifications.send_email_notification")
def send_email_notification(to_email: str, subject: str, body: str):
    """Send an email notification (replace with real SMTP in production)."""
    logger.info(f"[EMAIL] To: {to_email} | Subject: {subject}")
    logger.info(f"[EMAIL] Body: {body}")


@celery_app.task(name="app.workers.tasks.notifications.send_deadline_reminders")
def send_deadline_reminders():
    """Check for upcoming assignment deadlines and send reminders."""
    logger.info("Running deadline reminder task...")
    # TODO: Query quizzes due in 24h and send notifications
