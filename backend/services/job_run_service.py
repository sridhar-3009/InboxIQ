"""
Same-day idempotency guard for jobs that can be triggered from more
than one place — e.g. the in-process APScheduler cron AND an external
GitHub Actions trigger hitting the same endpoint. Whichever fires
first wins; the other is a harmless no-op.
"""
import logging
from datetime import date

from database import get_supabase

logger = logging.getLogger(__name__)


def claim_run(job_name: str, run_date: date | None = None) -> bool:
    """
    Atomically claim today's run for a job. Returns True if this call
    is the one that gets to run the job, False if it already ran today.
    """
    d = (run_date or date.today()).isoformat()
    try:
        get_supabase().table("job_runs").insert({"job_name": job_name, "run_date": d}).execute()
        return True
    except Exception:
        # Unique constraint violation (or any insert failure) means
        # someone already claimed today — safest default is to skip.
        return False
