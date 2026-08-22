-- ============================================================
-- InboxIQ v7 Migrations — Run in Supabase SQL Editor
-- ============================================================
-- Lightweight "small team hub": shared docs, file sharing, simple
-- chat, and workspace settings — built on the existing organizations
-- / org_members tables (team invites + roles already exist).

-- Shared docs (single-editor-at-a-time, not real-time collaborative)
CREATE TABLE IF NOT EXISTS team_docs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled',
    content TEXT DEFAULT '',
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_team_docs_org ON team_docs(org_id);

-- Shared files — metadata only; bytes live in the private
-- "team-files" Supabase Storage bucket, served via signed URLs.
CREATE TABLE IF NOT EXISTS team_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    content_type TEXT,
    size_bytes BIGINT,
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_team_files_org ON team_files(org_id);

-- Simple text chat — channels + messages
CREATE TABLE IF NOT EXISTS team_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, name)
);

CREATE TABLE IF NOT EXISTS team_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES team_channels(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    author_name TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_team_messages_channel ON team_messages(channel_id, created_at DESC);

-- Workspace settings — the web-appropriate equivalent of "policy"
-- (no device-level enforcement, since there's no device agent).
-- Invites already require an admin/owner role (see routes/teams.py),
-- so the one genuinely new enforceable setting is domain restriction.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS allowed_email_domains TEXT[];
