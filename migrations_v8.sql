-- ============================================================
-- InboxIQ v8 Migrations — Run in Supabase SQL Editor
-- ============================================================

-- Generic in-app notifications — also replaces the bell dropdown's
-- previously-static "No new notifications" placeholder with a real feed.
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'general',
    title TEXT NOT NULL,
    body TEXT,
    link TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

-- Doc folders (flat tag, not a nested tree — keeps the docs list scannable)
ALTER TABLE team_docs ADD COLUMN IF NOT EXISTS folder TEXT;
