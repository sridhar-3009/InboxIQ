"""
Email digest worker — sends daily or weekly email digests to users who opt in.
Runs via APScheduler: daily at 8am UTC, weekly on Mondays at 8am UTC.
"""
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)


async def _build_weekly_rollup_html(user_id: str) -> str:
    """Email debt + revenue-at-risk + relationship alerts, rolled into
    one 'state of your inbox' section for the weekly digest only."""
    from services.relationship_service import get_email_debt, compute_relationship_scores
    from services.revenue_service import get_revenue_at_risk

    try:
        debts = await get_email_debt(user_id)
        relationships = await compute_relationship_scores(user_id)
        at_risk = await get_revenue_at_risk(user_id)
    except Exception:
        logger.warning("Weekly rollup fetch failed for user %s", user_id, exc_info=True)
        return ""

    alerts = [r for r in relationships if r.get("alert")]
    if not debts and not at_risk and not alerts:
        return ""

    parts = ['<div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;">']
    parts.append('<h2 style="color:#111827;font-size:15px;margin:0 0 10px;">This week\'s state of your inbox</h2>')

    if debts:
        top = debts[:3]
        parts.append(f'<p style="color:#374151;font-size:13px;margin:8px 0 4px;"><strong>{len(debts)} email(s) still owed a reply</strong></p>')
        for d in top:
            parts.append(f'<p style="color:#6b7280;font-size:12px;margin:2px 0;">• {d["contact_name"]} — {d["days_owed"]}d</p>')

    if at_risk:
        parts.append(f'<p style="color:#374151;font-size:13px;margin:12px 0 4px;"><strong>{len(at_risk)} deal(s) at risk</strong> (open revenue tied to a fading relationship)</p>')
        for r in at_risk[:3]:
            amount = f"{r['currency']} {r['total_amount']:,.0f}" if r.get("total_amount") else ""
            parts.append(f'<p style="color:#6b7280;font-size:12px;margin:2px 0;">• {r["contact_name"]} — {amount}</p>')

    if alerts:
        parts.append(f'<p style="color:#374151;font-size:13px;margin:12px 0 4px;"><strong>{len(alerts)} relationship(s) gone quiet</strong></p>')
        for a in alerts[:3]:
            parts.append(f'<p style="color:#6b7280;font-size:12px;margin:2px 0;">• {a["contact_name"]} — {a["alert_message"]}</p>')

    parts.append('</div>')
    return "".join(parts)


def _build_digest_html(emails: list[dict], period_label: str, now: datetime, rollup_html: str = "") -> str:
    urgent = [e for e in emails if (e.get("category") or "") in ("urgent", "urgent_client_request")]
    needs_resp = [e for e in emails if (e.get("category") or "") in ("needs_response", "follow_up", "follow_up_required")]
    other = [e for e in emails if e not in urgent and e not in needs_resp]

    def rows(items: list[dict], limit: int = 5) -> str:
        html = ""
        for e in items[:limit]:
            subj = e.get("subject") or "(No Subject)"
            sender = e.get("sender") or "Unknown"
            priority = e.get("priority") or 0
            p_color = "#dc2626" if priority >= 8 else "#d97706" if priority >= 5 else "#16a34a"
            html += (
                f'<tr><td style="padding:6px 0;border-bottom:1px solid #f3f4f6;">'
                f'<span style="color:{p_color};font-weight:bold;font-size:11px;">●</span> '
                f'<strong style="font-size:13px;">{subj}</strong>'
                f'<span style="color:#6b7280;font-size:12px;"> — {sender}</span>'
                f'</td></tr>'
            )
        if len(items) > limit:
            html += f'<tr><td style="padding:4px 0;color:#9ca3af;font-size:12px;">…and {len(items)-limit} more</td></tr>'
        return html

    sections = ""
    if urgent:
        sections += f'<h3 style="color:#dc2626;margin:16px 0 6px;">🔴 Urgent ({len(urgent)})</h3><table width="100%">{rows(urgent)}</table>'
    if needs_resp:
        sections += f'<h3 style="color:#d97706;margin:16px 0 6px;">💬 Needs Response ({len(needs_resp)})</h3><table width="100%">{rows(needs_resp)}</table>'
    if other:
        sections += f'<h3 style="color:#374151;margin:16px 0 6px;">📧 Other ({len(other)})</h3><table width="100%">{rows(other, 3)}</table>'

    return f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;">
      <div style="background:white;border-radius:12px;padding:24px;border:1px solid #e5e7eb;">
        <h1 style="color:#111827;margin:0 0 4px;font-size:20px;">📬 Mailair {period_label} Digest</h1>
        <p style="color:#6b7280;font-size:13px;margin:0 0 16px;">{now.strftime('%B %d, %Y')} · {len(emails)} email{'s' if len(emails)!=1 else ''} received</p>
        {sections if sections else '<p style="color:#6b7280;">No emails in this period.</p>'}
        {rollup_html}
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;">
          <a href="https://mailair.company/email" style="background:#7c3aed;color:white;padding:8px 16px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">Open Inbox</a>
        </div>
        <p style="color:#9ca3af;font-size:11px;margin-top:16px;">
          To unsubscribe from digests, go to Settings → Notifications in Mailair.
        </p>
      </div>
    </div>"""


async def _send_digest_email(user_id: str, gmail_address: str, subject: str, html: str) -> bool:
    """Send digest via Gmail API on behalf of user."""
    try:
        from services.gmail_service import send_gmail_reply
        ok = await send_gmail_reply(
            user_id=user_id,
            thread_id="",
            to=gmail_address,
            subject=subject,
            body=html,
        )
        return ok
    except Exception as exc:
        logger.warning("send_digest_email failed for user %s: %s", user_id, exc)
        return False


async def run_digest(frequency: str = "daily") -> None:
    """
    Send digests for all opted-in users.
    frequency: 'daily' | 'weekly'
    """
    from database import get_supabase
    from services.slack_service import send_slack_notification

    try:
        supabase = get_supabase()

        profiles = supabase.table("user_profiles").select(
            "id, slack_webhook_url, full_name, email, digest_enabled, digest_frequency, gmail_connected"
        ).eq("digest_enabled", True).eq("digest_frequency", frequency).execute()

        users = profiles.data or []
        if not users:
            logger.info("No users opted into %s digest — skipping.", frequency)
            return

        now = datetime.now(timezone.utc)
        hours_back = 24 if frequency == "daily" else 168  # 7 days
        since = (now - timedelta(hours=hours_back)).isoformat()
        period_label = "Daily" if frequency == "daily" else "Weekly"

        for user in users:
            user_id = user["id"]
            gmail_address = user.get("email", "")
            try:
                result = supabase.table("emails").select(
                    "id, subject, sender, category, priority"
                ).eq("user_id", user_id).gte("received_at", since).execute()

                emails = result.data or []
                if not emails:
                    continue

                rollup_html = await _build_weekly_rollup_html(user_id) if frequency == "weekly" else ""
                html = _build_digest_html(emails, period_label, now, rollup_html)
                subject = f"[Mailair] {period_label} Digest — {len(emails)} email{'s' if len(emails)!=1 else ''}"

                sent = False
                if gmail_address and user.get("gmail_connected"):
                    sent = await _send_digest_email(user_id, gmail_address, subject, html)

                if not sent:
                    webhook_url = (user.get("slack_webhook_url") or "").strip()
                    if webhook_url:
                        text = f"*📬 Mailair {period_label} Digest — {len(emails)} emails*\n"
                        urgent = [e for e in emails if (e.get("category") or "") in ("urgent", "urgent_client_request")]
                        if urgent:
                            text += f"🔴 {len(urgent)} urgent · "
                        needs = [e for e in emails if (e.get("category") or "") in ("needs_response", "follow_up")]
                        if needs:
                            text += f"💬 {len(needs)} need response · "
                        text += f"View all: https://mailair.company/email"
                        await send_slack_notification(webhook_url, text)
                        sent = True

                if sent:
                    logger.info("%s digest delivered to user %s (%d emails)", period_label, user_id, len(emails))

            except Exception as exc:
                logger.error("%s digest failed for user %s: %s", period_label, user_id, exc)

    except Exception as exc:
        logger.error("run_digest error: %s", exc)


async def send_daily_digest() -> None:
    await run_digest("daily")


async def send_weekly_digest() -> None:
    await run_digest("weekly")
