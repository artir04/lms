from app.workers.celery_app import celery_app
import logging

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.tasks.analytics.generate_nightly_snapshots")
def generate_nightly_snapshots():
    """Generate nightly analytics snapshots for all active tenants."""
    logger.info("Generating nightly analytics snapshots...")
    # TODO: Iterate tenants, compute stats, write ReportSnapshot rows
