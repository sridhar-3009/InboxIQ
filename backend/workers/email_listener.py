"""
Background email listener — fetches new Gmail messages for all connected
users on a configurable schedule (default: every 5 minutes).

Intended to be started alongside the FastAPI application via APScheduler.
"""

import asyncio
import logging
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from database import get_supabase
from services.gmail_service import fetch_new_emails
from services.email_service import create_email
from models.email import EmailCreate

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def _get_gmail_connected_users() -> list[str]:
    """Return user IDs that currently have Gmail connected."""
    try:
        supabase = get_supabase()
        result = (
            supabase.table("user_profiles")
            .select("id")
            .eq("gmail_connected", True)
            .execute()
        )
        return [row["id"] for row in (result.data or [])]
    except Exception as exc:
        logger.error("Failed to fetch Gmail-connected users: %s", exc)
        return []


async def _sync_user_emails(user_id: str) -> None:
    """
    Fetch unread Gmail messages for one user and store new ones in Supabase.
    Does NOT run AI processing — users trigger that manually per email.
    """
    try:
        raw_emails = await fetch_new_emails(user_id=user_id)
        if not raw_emails:
            return

        logger.info("Fetched %d emails for user_id=%s", len(raw_emails), user_id)

        supabase = get_supabase()

        incoming_ids = [r.get("gmail_message_id") for r in raw_emails if r.get("gmail_message_id")]
        existing_ids: set[str] = set()
        if incoming_ids:
            existing_result = (
                supabase.table("emails")
                .select("gmail_message_id")
                .eq("user_id", user_id)
                .in_("gmail_message_id", incoming_ids)
                .execute()
            )
            existing_ids = {row["gmail_message_id"] for row in (existing_result.data or [])}

        for raw in raw_emails:
            gmail_message_id = raw.get("gmail_message_id")
            if gmail_message_id and gmail_message_id in existing_ids:
                continue

            email_create = EmailCreate(
                user_id=user_id,
                subject=raw.get("subject", "(No Subject)"),
                sender=raw.get("sender", ""),
                body=raw.get("body", ""),
                received_at=raw.get("received_at"),
                gmail_message_id=gmail_message_id,
                thread_id=raw.get("thread_id"),
                labels=raw.get("labels", []),
            )

            await create_email(email_create)

    except Exception as exc:
        logger.error("Error syncing emails for user_id=%s: %s", user_id, exc)


async def _process_user_emails(user_id: str) -> None:
    """
    Fetch and store emails, then auto-run AI processing.
    Used by the background poll (poll_all_users) — not triggered by manual sync.
    """
    from services.ai_processor import process_email as ai_process

    try:
        raw_emails = await fetch_new_emails(user_id=user_id)
        if not raw_emails:
            return

        logger.info("Fetched %d emails for user_id=%s", len(raw_emails), user_id)

        supabase = get_supabase()

        # Batch dedup: one query for all message IDs instead of N queries
        incoming_ids = [r.get("gmail_message_id") for r in raw_emails if r.get("gmail_message_id")]
        existing_ids: set[str] = set()
        if incoming_ids:
            existing_result = (
                supabase.table("emails")
                .select("gmail_message_id")
                .eq("user_id", user_id)
                .in_("gmail_message_id", incoming_ids)
                .execute()
            )
            existing_ids = {row["gmail_message_id"] for row in (existing_result.data or [])}

        for raw in raw_emails:
            gmail_message_id = raw.get("gmail_message_id")
            if gmail_message_id and gmail_message_id in existing_ids:
                continue

            email_create = EmailCreate(
                user_id=user_id,
                subject=raw.get("subject", "(No Subject)"),
                sender=raw.get("sender", ""),
                body=raw.get("body", ""),
                received_at=raw.get("received_at"),
                gmail_message_id=gmail_message_id,
                thread_id=raw.get("thread_id"),
                labels=raw.get("labels", []),
            )

            stored = await create_email(email_create)
            if stored:
                asyncio.create_task(ai_process(stored))

    except Exception as exc:
        logger.error(
            "Error processing emails for user_id=%s: %s", user_id, exc
        )


async def poll_all_users() -> None:
    """
    Poll Gmail for every connected user.  Runs as a scheduled job.
    """
    logger.debug("Email listener poll started.")
    user_ids = await _get_gmail_connected_users()

    if not user_ids:
        logger.debug("No Gmail-connected users found; skipping poll.")
        return

    # Fan out concurrently, capped to avoid hitting rate limits
    semaphore = asyncio.Semaphore(5)

    async def _bounded(uid: str) -> None:
        async with semaphore:
            await _process_user_emails(uid)

    await asyncio.gather(*[_bounded(uid) for uid in user_ids], return_exceptions=True)
    logger.debug("Email listener poll complete (%d users).", len(user_ids))


async def send_deadline_reminders() -> None:
    """Daily job: alert users about overdue or due-in-24h action items via Slack and web push."""
    from services.slack_service import send_slack_notification
    from routes.push import send_push_to_user
    try:
        supabase = get_supabase()
        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc)
        tomorrow = now + timedelta(hours=24)

        result = supabase.table("actions").select(
            "id, task, deadline, email_id, emails(user_id)"
        ).eq("status", "pending").not_.is_("deadline", "null").execute()

        user_actions: dict[str, list[dict]] = {}
        for row in (result.data or []):
            try:
                deadline = datetime.fromisoformat(row["deadline"].replace("Z", "+00:00"))
            except Exception:
                continue
            if deadline > tomorrow:
                continue
            user_id = (row.get("emails") or {}).get("user_id")
            if not user_id:
                continue
            user_actions.setdefault(user_id, []).append({
                "task": row["task"],
                "deadline_str": deadline.strftime("%b %d %H:%M UTC"),
                "overdue": deadline < now,
            })

        for user_id, items in user_actions.items():
            try:
                overdue = [a for a in items if a["overdue"]]
                upcoming = [a for a in items if not a["overdue"]]

                # Web push notification
                if overdue:
                    push_title = f"⏰ {len(overdue)} overdue task{'s' if len(overdue) > 1 else ''}"
                    push_body = overdue[0]["task"]
                    if len(overdue) > 1:
                        push_body += f" (+{len(overdue) - 1} more)"
                elif upcoming:
                    push_title = f"📋 {len(upcoming)} task{'s' if len(upcoming) > 1 else ''} due soon"
                    push_body = upcoming[0]["task"] + f" — due {upcoming[0]['deadline_str']}"
                else:
                    continue

                await send_push_to_user(user_id, push_title, push_body, "/actions")

                # Slack notification (if webhook configured)
                profile = supabase.table("user_profiles").select(
                    "slack_webhook_url"
                ).eq("id", user_id).single().execute()
                webhook_url = (profile.data or {}).get("slack_webhook_url", "").strip()
                if webhook_url:
                    lines = ["*⏰ Mailair Task Reminder*\n"]
                    if overdue:
                        lines.append(f"*🔴 Overdue ({len(overdue)}):*")
                        for a in overdue[:5]:
                            lines.append(f"  • {a['task']} — was due {a['deadline_str']}")
                    if upcoming:
                        lines.append(f"*🟡 Due in 24h ({len(upcoming)}):*")
                        for a in upcoming[:5]:
                            lines.append(f"  • {a['task']} — due {a['deadline_str']}")
                    await send_slack_notification(webhook_url, "\n".join(lines))

                logger.info("Deadline reminder sent to user %s (%d items)", user_id, len(items))
            except Exception as exc:
                logger.error("Reminder failed for user %s: %s", user_id, exc)
    except Exception as exc:
        logger.error("send_deadline_reminders error: %s", exc)


async def flush_scheduled_sends() -> None:
    """Every 5 min: send any scheduled emails whose send_at has passed."""
    from datetime import timezone
    from services.gmail_service import send_gmail_compose
    try:
        supabase = get_supabase()
        now = datetime.now(timezone.utc).isoformat()
        pending = supabase.table("scheduled_sends").select("*").eq(
            "status", "pending"
        ).lte("send_at", now).execute()
        rows = pending.data or []
        if not rows:
            return
        logger.info("flush_scheduled_sends: sending %d scheduled email(s)", len(rows))
        for row in rows:
            try:
                ok = await send_gmail_compose(
                    user_id=row["user_id"],
                    to=row["to_email"],
                    subject=row["subject"],
                    body=row["body"],
                )
                status = "sent" if ok else "failed"
                supabase.table("scheduled_sends").update({
                    "status": status,
                    "sent_at": datetime.now(timezone.utc).isoformat() if ok else None,
                    "error": None if ok else "Gmail send failed",
                }).eq("id", row["id"]).execute()
            except Exception as exc:
                logger.error("flush_scheduled_sends row %s failed: %s", row["id"], exc)
                try:
                    supabase.table("scheduled_sends").update({
                        "status": "failed", "error": str(exc)
                    }).eq("id", row["id"]).execute()
                except Exception:
                    pass
    except Exception as exc:
        logger.error("flush_scheduled_sends error: %s", exc)


def start_email_listener() -> AsyncIOScheduler:
    """
    Register the polling job and start the APScheduler instance.
    Called once during application startup.
    """
    from workers.digest_worker import send_daily_digest, send_weekly_digest
    from services.newsletter_service import send_weekly_ai_newsletter
    from services.sequence_service import flush_sequence_steps
    from workers.social_poster import post_daily_social
    from database import keep_supabase_alive
    from workers.reminder_worker import send_email_debt_reminders

    scheduler.add_job(
        poll_all_users,
        trigger="interval",
        minutes=5,
        id="email_listener",
        name="Gmail Email Poller",
        replace_existing=True,
        misfire_grace_time=60,
    )
    scheduler.add_job(
        send_daily_digest,
        trigger="cron",
        hour=8,
        minute=0,
        id="daily_digest",
        name="Daily Email Digest",
        replace_existing=True,
        misfire_grace_time=300,
    )
    scheduler.add_job(
        send_weekly_digest,
        trigger="cron",
        hour=8,
        minute=0,
        day_of_week="mon",
        id="weekly_digest",
        name="Weekly Email Digest",
        replace_existing=True,
        misfire_grace_time=300,
    )
    scheduler.add_job(
        send_deadline_reminders,
        trigger="cron",
        hour=9,
        minute=0,
        id="deadline_reminders",
        name="Daily Deadline Reminders",
        replace_existing=True,
        misfire_grace_time=300,
    )
    scheduler.add_job(
        flush_scheduled_sends,
        trigger="interval",
        minutes=5,
        id="scheduled_sends",
        name="Flush Scheduled Email Sends",
        replace_existing=True,
        misfire_grace_time=60,
    )
    scheduler.add_job(
        flush_sequence_steps,
        trigger="interval",
        hours=4,
        id="sequence_flush",
        name="Follow-up Sequence Step Sender",
        replace_existing=True,
        misfire_grace_time=300,
    )
    scheduler.add_job(
        send_weekly_ai_newsletter,
        trigger="cron",
        hour=9,
        minute=0,
        day_of_week="mon",
        id="weekly_ai_newsletter",
        name="Weekly AI Newsletter",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    scheduler.add_job(
        post_daily_social,
        trigger="cron",
        hour=15,
        minute=0,
        id="daily_social_post",
        name="Daily Social Post (Instagram / LinkedIn via Zernio)",
        replace_existing=True,
        misfire_grace_time=1800,
    )
    scheduler.add_job(
        send_email_debt_reminders,
        trigger="cron",
        hour=10,
        minute=0,
        id="email_debt_reminders",
        name="Email Debt Reminders",
        replace_existing=True,
        misfire_grace_time=1800,
    )
    scheduler.add_job(
        keep_supabase_alive,
        trigger="interval",
        days=3,
        id="supabase_keepalive",
        name="Supabase Keep-Alive Ping (avoids the 7-day auto-pause)",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    scheduler.start()
    logger.info("Email listener scheduler started (every 5 minutes).")
    return scheduler


def stop_email_listener() -> None:
    """Gracefully stop the scheduler on application shutdown."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Email listener scheduler stopped.")
