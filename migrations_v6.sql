-- ============================================================
-- InboxIQ v6 Migrations — Run in Supabase SQL Editor
-- ============================================================

-- Manually-logged calls / SMS / WhatsApp / meetings, so relationship
-- health and "email debt" reflect the whole client relationship, not
-- just email. (No live Twilio/WhatsApp Business API wiring yet — this
-- is the data model + manual entry; a real integration would insert
-- into this same table.)
CREATE TABLE IF NOT EXISTS client_touchpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_email TEXT NOT NULL,
    contact_name TEXT,
    channel TEXT NOT NULL DEFAULT 'call' CHECK (channel IN ('call', 'sms', 'whatsapp', 'meeting', 'other')),
    direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
    summary TEXT,
    duration_minutes INTEGER,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_touchpoints_user_contact ON client_touchpoints(user_id, contact_email);
CREATE INDEX IF NOT EXISTS idx_touchpoints_occurred_at ON client_touchpoints(occurred_at DESC);

-- Vertical / industry tagging + opt-in to the public benchmark aggregate
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS benchmark_opt_in BOOLEAN DEFAULT FALSE;
