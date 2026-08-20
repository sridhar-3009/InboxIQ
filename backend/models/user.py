from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserProfile(BaseModel):
    id: str
    name: Optional[str] = None
    email: str
    plan: str = "free"
    company_description: Optional[str] = None
    tone_preference: Optional[str] = "professional"
    slack_webhook_url: Optional[str] = None
    gmail_connected: bool = False
    created_at: Optional[datetime] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    company_description: Optional[str] = None
    tone_preference: Optional[str] = None
    slack_webhook_url: Optional[str] = None
    email_notifications: Optional[bool] = None
    slack_notifications: Optional[bool] = None
    notification_frequency: Optional[str] = None
    auto_process_emails: Optional[bool] = None
    priority_threshold: Optional[int] = None
    vacation_mode: Optional[bool] = None
    vacation_message: Optional[str] = None
    email_signature: Optional[str] = None
    badge_enabled: Optional[bool] = None
    # Email digest preferences
    digest_enabled: Optional[bool] = None
    digest_frequency: Optional[str] = None  # 'daily' | 'weekly'
    # Selective Gmail sync filters
    sync_labels: Optional[list] = None          # e.g. ["INBOX", "CATEGORY_PROMOTIONS"]
    sync_max_emails: Optional[int] = None        # 10 / 25 / 50 / 100
    sync_days_back: Optional[int] = None         # only fetch emails newer than N days
    sync_sender_allowlist: Optional[list] = None # only from these domains/emails
    sync_sender_blocklist: Optional[list] = None # never from these domains/emails


class ReplyDraftResponse(BaseModel):
    id: str
    email_id: str
    draft_text: str
    confidence: float
    created_at: datetime

    class Config:
        from_attributes = True


class ReplyDraftUpdate(BaseModel):
    draft_text: str
