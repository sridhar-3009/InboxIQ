-- ============================================================
-- InboxIQ v5 Migrations — Run in Supabase SQL Editor
-- ============================================================

-- Public response-time trust badge (opt-in)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS badge_enabled BOOLEAN DEFAULT FALSE;
