-- ============================================================
-- InboxIQ v9 Migrations — Run in Supabase SQL Editor
-- ============================================================

-- File folders (parity with team_docs.folder)
ALTER TABLE team_files ADD COLUMN IF NOT EXISTS folder TEXT;

-- One-level doc version recovery — the previous saved content is kept
-- so an accidental overwrite isn't destructive. Not full version
-- history, just one step back.
ALTER TABLE team_docs ADD COLUMN IF NOT EXISTS previous_content TEXT;
ALTER TABLE team_docs ADD COLUMN IF NOT EXISTS previous_title TEXT;
ALTER TABLE team_docs ADD COLUMN IF NOT EXISTS previous_saved_at TIMESTAMPTZ;
