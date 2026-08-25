-- ============================================================
-- InboxIQ v11 Migrations — Run in Supabase SQL Editor
-- Email marketing: audiences, campaigns, sends, suppression, usage.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS marketing_audiences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_marketing_audiences_org ON marketing_audiences(org_id);

CREATE TABLE IF NOT EXISTS marketing_audience_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audience_id UUID NOT NULL REFERENCES marketing_audiences(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    subscribed BOOLEAN NOT NULL DEFAULT TRUE,
    unsubscribed_at TIMESTAMPTZ,
    unsubscribe_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(audience_id, email)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_audience_contacts_token ON marketing_audience_contacts(unsubscribe_token);
CREATE INDEX IF NOT EXISTS idx_marketing_audience_contacts_audience ON marketing_audience_contacts(audience_id);

CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    audience_id UUID NOT NULL REFERENCES marketing_audiences(id),
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    from_name TEXT,
    status TEXT NOT NULL DEFAULT 'draft',  -- draft | sending | sent | failed
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_org ON marketing_campaigns(org_id);

CREATE TABLE IF NOT EXISTS marketing_campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | sent | failed | opened | clicked | bounced | complained
    resend_email_id TEXT,
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    UNIQUE(campaign_id, email)
);
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_recipients_campaign ON marketing_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_recipients_resend_id ON marketing_campaign_recipients(resend_email_id);

CREATE TABLE IF NOT EXISTS marketing_suppressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    reason TEXT NOT NULL,  -- unsubscribed | bounced | complained
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, email)
);

CREATE TABLE IF NOT EXISTS marketing_usage (
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period TEXT NOT NULL,  -- 'YYYY-MM'
    emails_sent INT NOT NULL DEFAULT 0,
    PRIMARY KEY (org_id, period)
);

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS marketing_plan TEXT NOT NULL DEFAULT 'free';
-- free=1000, growth=10000, scale=50000, pro=200000 (enforced in app code; see campaign_service.PLAN_LIMITS)
