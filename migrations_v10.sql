-- ============================================================
-- InboxIQ v10 Migrations — Run in Supabase SQL Editor
-- ============================================================

-- Idempotency guard for jobs that can be triggered from more than one
-- place (the in-process APScheduler cron AND an external GitHub
-- Actions trigger) — prevents a double-post if both happen to fire
-- around the same time.
CREATE TABLE IF NOT EXISTS job_runs (
    job_name TEXT NOT NULL,
    run_date DATE NOT NULL,
    ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (job_name, run_date)
);
