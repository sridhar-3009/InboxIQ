"""
Email-debt reminders — turns the previously display-only "email debt"
widget into an actual nudge. Runs once daily: for anyone with at least
one email owed 3+ days, sends one summary notification (in-app, plus
Slack if they have a webhook configured) — not one per email, to avoid
spamming.
"""
import logging

from database import get_supabase
from services.relationship_service import get_email_debt
from services.notification_service import create_notification
from services.slack_service import send_slack_notification

logger = logging.getLogger(__name__)

DEBT_THRESHOLD_DAYS = 3


async def send_email_debt_reminders() -> None:
    try:
        supabase = get_supabase()
        profiles = supabase.table("user_profiles").select(
            "id, slack_webhook_url, gmail_connected"
        ).eq("gmail_connected", True).execute()

        for profile in profiles.data or []:
            user_id = profile["id"]
            try:
                debts = await get_email_debt(user_id)
                overdue = [d for d in debts if d["days_owed"] >= DEBT_THRESHOLD_DAYS]
                if not overdue:
                    continue

                oldest = overdue[0]
                title = f"{len(overdue)} email{'s' if len(overdue) != 1 else ''} you still owe a reply"
                body = f"Oldest: {oldest['contact_name']} — {oldest['days_owed']} days"
                create_notification(
                    user_id=user_id, notif_type="email_debt", title=title, body=body, link="/relationships",
                )

                webhook_url = (profile.get("slack_webhook_url") or "").strip()
                if webhook_url:
                    await send_slack_notification(
                        webhook_url,
                        f"*{title}*\n{body}\nView: https://mailair.company/relationships",
                    )
            except Exception as exc:
                logger.error("Email-debt reminder failed for user %s: %s", user_id, exc)
    except Exception as exc:
        logger.error("send_email_debt_reminders error: %s", exc)
