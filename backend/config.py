import json
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Supabase
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_KEY: str

    # Anthropic / Claude
    ANTHROPIC_API_KEY: str

    # Gmail OAuth
    GMAIL_CLIENT_ID: str = ""
    GMAIL_CLIENT_SECRET: str = ""
    GMAIL_REDIRECT_URI: str = "http://localhost:8000/api/integrations/gmail/callback"

    # Microsoft / Outlook OAuth
    MS_CLIENT_ID: str = ""
    MS_CLIENT_SECRET: str = ""
    MS_REDIRECT_URI: str = "http://localhost:8000/api/integrations/outlook/callback"

    # Google Calendar OAuth
    GCAL_CLIENT_ID: str = ""
    GCAL_CLIENT_SECRET: str = ""
    GCAL_REDIRECT_URI: str = "http://localhost:8000/api/integrations/calendar/callback"

    # Slack
    SLACK_WEBHOOK_URL: str = ""

    # Razorpay
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""
    RAZORPAY_PRO_PLAN_ID: str = ""      # plan_xxx from Razorpay dashboard
    RAZORPAY_AGENCY_PLAN_ID: str = ""   # plan_xxx from Razorpay dashboard

    # Frontend base URL (used for Razorpay checkout callback URLs)
    FRONTEND_URL: str = "http://localhost:3000"

    # Platform admin
    ADMIN_EMAIL: str = "saisridhart@gmail.com"

    # Resend (email sending)
    RESEND_API_KEY: str = ""

    # JWT / Auth
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # AI Thresholds
    URGENCY_THRESHOLD: int = 7

    # VAPID keys for Web Push (generate with: python -c "from py_vapid import Vapid; v=Vapid(); v.generate_keys(); print(v.private_key); print(v.public_key)")
    VAPID_PRIVATE_KEY: str = ""
    VAPID_PUBLIC_KEY: str = ""
    VAPID_EMAIL: str = "mailto:admin@mailair.company"

    # Zernio (social posting — Instagram / LinkedIn)
    ZERNIO_API_KEY: str = ""
    ZERNIO_INSTAGRAM_ACCOUNT_ID: str = ""
    ZERNIO_LINKEDIN_ACCOUNT_ID: str = ""
    ZERNIO_LINKEDIN_ORG_URN: str = ""  # e.g. urn:li:organization:123456 — omit to post to a personal profile instead
    SOCIAL_AUTOPOST_ENABLED: bool = False  # daily cron only fires when this is explicitly true

    # Environment
    ENVIRONMENT: str = "development"

    # CORS — accepts a JSON array string or comma-separated string in .env
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://mailair.company",
        "https://www.mailair.company",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return ["http://localhost:3000", "http://localhost:5173"]
            # Try JSON array first: ["url1","url2"]
            if v.startswith("["):
                try:
                    return json.loads(v)
                except json.JSONDecodeError:
                    pass
            # Fall back to comma-separated: url1,url2
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


settings = Settings()
