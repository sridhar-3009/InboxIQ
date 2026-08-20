import logging
from datetime import datetime, timezone

from config import settings
from database import get_supabase
from ai.classifier import classify_email
from ai.reply_generator import generate_reply
from ai.embeddings import find_similar_replies, store_reply_embedding
from services.slack_service import send_urgent_alert
from services.gmail_service import get_email_attachments

logger = logging.getLogger(__name__)


async def process_email(email: dict) -> dict | None:
    """
    Full AI processing pipeline for a single email.

    Steps
    -----
    1. Classify the email (category, priority, summary, action items).
    2. Update the email record with classification results.
    3. Save action items to the actions table.
    4. Find similar past replies (pgvector).
    5. Generate a reply draft.
    6. Persist reply draft and store its embedding for future lookups.
    7. Send a Slack alert if priority >= URGENCY_THRESHOLD.

    Returns the updated email dict, or None on fatal error.
    """
    email_id = email.get("id")
    user_id = email.get("user_id")
    subject = email.get("subject", "")
    sender = email.get("sender", "")
    body = email.get("body", "")

    if not email_id or not user_id:
        logger.error("process_email called with incomplete email record: %s", email)
        return None

    # ------------------------------------------------------------------
    # Step 0 – Fetch attachment metadata so AI knows what's attached
    # ------------------------------------------------------------------
    attachment_filenames: list[str] = []
    gmail_message_id = email.get("gmail_message_id")
    if gmail_message_id:
        try:
            attachments_meta = await get_email_attachments(
                user_id=user_id, gmail_message_id=gmail_message_id
            )
            attachment_filenames = [a["filename"] for a in attachments_meta if a.get("filename")]
        except Exception as exc:
            logger.warning("Could not fetch attachments for email_id=%s: %s", email_id, exc)

    # ------------------------------------------------------------------
    # Step 1 – Classify
    # ------------------------------------------------------------------
    try:
        analysis = await classify_email(
            subject=subject, sender=sender, body=body, attachments=attachment_filenames
        )
    except Exception as exc:
        logger.error("classify_email failed for email_id=%s: %s", email_id, exc)
        analysis = {
            "category": "informational",
            "priority_score": 5,
            "summary": "Classification failed.",
            "action_items": [],
            "confidence_score": 0.0,
        }

    # ------------------------------------------------------------------
    # Step 2 – Persist classification onto the email row
    # ------------------------------------------------------------------
    try:
        supabase = get_supabase()
        update_data: dict = {
            "category": analysis["category"],
            "priority": analysis["priority_score"],
            "ai_summary": analysis["summary"],
            "confidence_score": analysis["confidence_score"],
            "processed": True,
        }
        if analysis.get("is_invoice"):
            update_data["ai_analysis"] = {
                "is_invoice": True,
                "invoice_amount": analysis.get("invoice_amount"),
                "invoice_due_date": analysis.get("invoice_due_date"),
                "invoice_vendor": analysis.get("invoice_vendor"),
                "is_phishing": analysis.get("is_phishing", False),
                "phishing_indicators": analysis.get("phishing_indicators", []),
            }
        supabase.table("emails").update(update_data).eq("id", email_id).execute()
    except Exception as exc:
        logger.error(
            "Failed to update email record for email_id=%s: %s", email_id, exc
        )

    # ------------------------------------------------------------------
    # Step 3 – Save action items
    # ------------------------------------------------------------------
    action_items = analysis.get("action_items", [])
    if action_items:
        await _save_action_items(email_id=email_id, action_items=action_items)

    # ------------------------------------------------------------------
    # Step 4 – Fetch user profile for personalised reply
    # ------------------------------------------------------------------
    company_description = "a professional service business"
    tone = "professional and friendly"
    slack_webhook_url = ""
    vacation_mode = False
    vacation_message = ""
    email_signature = ""

    try:
        profile_result = (
            supabase.table("user_profiles")
            .select("company_description, tone_preference, slack_webhook_url, vacation_mode, vacation_message, email_signature, industry")
            .eq("id", user_id)
            .single()
            .execute()
        )
        if profile_result.data:
            profile = profile_result.data
            company_description = (
                profile.get("company_description")
                or (f"a {profile['industry']} business" if profile.get("industry") else None)
                or company_description
            )
            tone = profile.get("tone_preference") or tone
            slack_webhook_url = profile.get("slack_webhook_url") or ""
            vacation_mode = bool(profile.get("vacation_mode", False))
            vacation_message = profile.get("vacation_message") or ""
            email_signature = profile.get("email_signature") or ""
    except Exception as exc:
        logger.warning("Could not fetch user profile for user_id=%s: %s", user_id, exc)

    # Detect email language from classification
    detected_language = analysis.get("language", "en")

    # ------------------------------------------------------------------
    # Step 5 – Find similar past replies (pgvector RAG)
    # ------------------------------------------------------------------
    similar_replies: list[str] = []
    try:
        similar_replies = await find_similar_replies(
            user_id=user_id,
            email_text=f"{subject}\n{body}",
            limit=3,
        )
    except Exception as exc:
        logger.warning("find_similar_replies failed: %s", exc)

    # ------------------------------------------------------------------
    # Step 6 – Generate reply draft
    # ------------------------------------------------------------------
    draft_text = ""
    confidence = 0.0
    try:
        draft_text, confidence = await generate_reply(
            subject=subject,
            sender=sender,
            body=body,
            company_description=company_description,
            tone=tone,
            similar_replies=similar_replies,
            attachments=attachment_filenames,
            reply_language=detected_language,
        )
    except Exception as exc:
        logger.error("generate_reply failed for email_id=%s: %s", email_id, exc)
        draft_text = "Thank you for your email. We will get back to you shortly."
        confidence = 0.3

    # ------------------------------------------------------------------
    # Step 6a – Append email signature if set
    # ------------------------------------------------------------------
    if email_signature:
        draft_text = draft_text.rstrip() + "\n\n" + email_signature.strip()

    # ------------------------------------------------------------------
    # Step 6c – Prepend vacation auto-reply note if vacation mode is on
    # ------------------------------------------------------------------
    if vacation_mode:
        auto_reply_note = vacation_message.strip() if vacation_message else (
            "I am currently out of the office and will respond when I return."
        )
        vacation_prefix = f"[Auto-Reply Note]: {auto_reply_note}\n\n---\n\n"
        draft_text = vacation_prefix + draft_text

    # ------------------------------------------------------------------
    # Step 6d – Persist reply draft
    # ------------------------------------------------------------------
    try:
        supabase.table("reply_drafts").upsert(
            {
                "email_id": email_id,
                "user_id": user_id,
                "draft_text": draft_text,
                "confidence": confidence,
            },
            on_conflict="email_id",
        ).execute()
    except Exception as exc:
        logger.error("Failed to store reply draft for email_id=%s: %s", email_id, exc)

    # ------------------------------------------------------------------
    # Step 6c – Store reply embedding for future RAG lookups
    # ------------------------------------------------------------------
    try:
        await store_reply_embedding(
            user_id=user_id, email_id=email_id, reply_text=draft_text
        )
    except Exception as exc:
        logger.warning(
            "store_reply_embedding failed for email_id=%s: %s", email_id, exc
        )

    # ------------------------------------------------------------------
    # Step 7 – Slack alert for urgent emails
    # ------------------------------------------------------------------
    priority = analysis.get("priority_score", 0)
    if priority >= settings.URGENCY_THRESHOLD and slack_webhook_url:
        alert_data = {
            "id": email_id,
            "subject": subject,
            "sender": sender,
            "ai_summary": analysis["summary"],
            "priority": priority,
            "category": analysis["category"],
        }
        try:
            await send_urgent_alert(
                webhook_url=slack_webhook_url, email_data=alert_data
            )
        except Exception as exc:
            logger.warning(
                "send_urgent_alert failed for email_id=%s: %s", email_id, exc
            )

    # Step 7b – Browser push notification for urgent emails
    if priority >= settings.URGENCY_THRESHOLD:
        try:
            from routes.push import send_push_to_user
            await send_push_to_user(
                user_id=user_id,
                title=f"🔴 Urgent: {subject[:60]}",
                body=analysis.get("summary", sender) or sender,
                url=f"/email/{email_id}",
            )
        except Exception as exc:
            logger.debug("push notification failed for email_id=%s: %s", email_id, exc)

    # ------------------------------------------------------------------
    # Step 8 – CRM sync (HubSpot / Salesforce)
    # ------------------------------------------------------------------
    try:
        crm_profile = supabase.table("user_profiles").select(
            "hubspot_connected, hubspot_api_key, "
            "sf_connected, sf_consumer_key, sf_consumer_secret, "
            "sf_username, sf_password, sf_security_token"
        ).eq("id", user_id).single().execute()
        cp = crm_profile.data or {}

        # Skip CRM sync for spam/newsletters
        email_category = analysis.get("category", "")
        if email_category not in ("spam", "newsletter"):
            if cp.get("hubspot_connected") and cp.get("hubspot_api_key"):
                from services.hubspot_service import sync_email_to_hubspot
                await sync_email_to_hubspot(
                    api_key=cp["hubspot_api_key"],
                    sender_email=sender,
                    sender_name=email.get("from_name", ""),
                    subject=subject,
                    summary=analysis.get("summary", ""),
                )

            if cp.get("sf_connected") and cp.get("sf_username"):
                from services.salesforce_service import sync_email_to_salesforce
                await sync_email_to_salesforce(
                    consumer_key=cp.get("sf_consumer_key", ""),
                    consumer_secret=cp.get("sf_consumer_secret", ""),
                    username=cp.get("sf_username", ""),
                    password=cp.get("sf_password", ""),
                    security_token=cp.get("sf_security_token", ""),
                    sender_email=sender,
                    sender_name=email.get("from_name", ""),
                    subject=subject,
                    summary=analysis.get("summary", ""),
                )
    except Exception as exc:
        logger.warning("CRM sync failed for email_id=%s: %s", email_id, exc)

    # ------------------------------------------------------------------
    # Step 9 – Auto-assign rules
    # ------------------------------------------------------------------
    try:
        _apply_auto_assign_rules(
            user_id=user_id,
            email_id=email_id,
            sender=sender,
            category=analysis.get("category", ""),
            priority_score=priority,
        )
    except Exception as exc:
        logger.warning("auto_assign_rules failed for email_id=%s: %s", email_id, exc)

    # ------------------------------------------------------------------
    # Step 9 – Fire outbound webhooks
    # ------------------------------------------------------------------
    try:
        from services.webhook_service import fire_event_sync
        wh_payload = {
            "email_id": email_id,
            "subject": subject,
            "sender": sender,
            "category": analysis["category"],
            "priority_score": priority,
            "summary": analysis["summary"],
        }
        if priority >= settings.URGENCY_THRESHOLD:
            fire_event_sync(user_id, "urgent_email", wh_payload)
    except Exception as exc:
        logger.warning("webhook_fire failed for email_id=%s: %s", email_id, exc)

    logger.info(
        "AI processing complete for email_id=%s | category=%s | priority=%s",
        email_id,
        analysis["category"],
        priority,
    )

    return {
        **email,
        "category": analysis["category"],
        "priority": priority,
        "ai_summary": analysis["summary"],
        "confidence_score": analysis["confidence_score"],
        "processed": True,
    }


async def _save_action_items(email_id: str, action_items: list[dict]) -> None:
    """Insert extracted action items into the actions table."""
    try:
        supabase = get_supabase()
        rows = []
        for item in action_items:
            task = item.get("task", "")
            if not task:
                continue
            deadline_raw = item.get("deadline")
            deadline = None
            if deadline_raw:
                try:
                    deadline = datetime.fromisoformat(str(deadline_raw))
                except ValueError:
                    deadline = None
            rows.append(
                {
                    "email_id": email_id,
                    "task": task,
                    "deadline": deadline.isoformat() if deadline else None,
                    "status": "pending",
                }
            )
        if rows:
            supabase.table("actions").insert(rows).execute()
    except Exception as exc:
        logger.error(
            "_save_action_items error (email_id=%s): %s", email_id, exc
        )


def _apply_auto_assign_rules(
    user_id: str,
    email_id: str,
    sender: str,
    category: str,
    priority_score: int,
) -> None:
    """Check org auto-assign rules and create an email_assignment if a rule matches."""
    supabase = get_supabase()

    profile = supabase.table("user_profiles").select("org_id").eq("id", user_id).single().execute()
    org_id = (profile.data or {}).get("org_id")
    if not org_id:
        return

    rules_result = supabase.table("auto_assign_rules").select("*").eq("org_id", org_id).eq("is_active", True).execute()
    rules = rules_result.data or []
    if not rules:
        return

    for rule in rules:
        ctype = rule["condition_type"]
        cval = rule["condition_value"]
        matched = False

        if ctype == "sender_domain":
            domain = cval.lstrip("@").lower()
            matched = sender.lower().endswith("@" + domain)
        elif ctype == "category":
            matched = category.lower() == cval.lower()
        elif ctype == "priority_gte":
            try:
                matched = priority_score >= int(cval)
            except ValueError:
                pass

        if matched:
            assign_to = rule["assign_to_user_id"]
            try:
                supabase.table("email_assignments").upsert({
                    "email_id": email_id,
                    "org_id": org_id,
                    "assigned_to": assign_to,
                    "assigned_by": None,
                }, on_conflict="email_id").execute()
                logger.info(
                    "Auto-assigned email_id=%s to user_id=%s via rule %s",
                    email_id, assign_to, rule["id"]
                )
            except Exception as exc:
                logger.warning("auto-assign upsert failed: %s", exc)
            break  # Only first matching rule
