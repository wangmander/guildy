-- COMPREHENSIVE PIPELINES SETUP
-- Run this ENTIRE script in your Supabase SQL Editor to fix missing pipelines

-- 1. Create the pipelines table if it doesn't exist
CREATE TABLE IF NOT EXISTS pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    company TEXT NOT NULL DEFAULT 'Unknown',
    role TEXT DEFAULT 'Interview',
    status TEXT DEFAULT 'WAITING',
    stage TEXT DEFAULT 'Applied',
    stage_detail TEXT,
    next_action TEXT,
    action_needed BOOLEAN DEFAULT FALSE,
    last_email_at TIMESTAMPTZ,
    last_email_subject TEXT,
    last_email_snippet TEXT,
    last_email_from_name TEXT,
    last_email_from_email TEXT,
    prep_json JSONB,
    insights_json JSONB,
    company_intel_json JSONB,
    predicted_stages TEXT[], -- This was the missing column
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add predicted_stages column if missing (safe - won't error if exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pipelines' AND column_name = 'predicted_stages'
    ) THEN
        ALTER TABLE pipelines ADD COLUMN predicted_stages TEXT[];
    END IF;
END $$;

-- 3. Create emails table if missing
CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
    gmail_id TEXT,
    gmail_thread_id TEXT,
    gmail_message_id TEXT UNIQUE,
    subject TEXT,
    snippet TEXT,
    from_name TEXT,
    from_email TEXT,
    body_text TEXT,
    received_at TIMESTAMPTZ,
    analysis_json JSONB,
    is_recruiting BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Grant service role full access (bypasses RLS)
GRANT ALL ON pipelines TO service_role;
GRANT ALL ON emails TO service_role;

-- 5. Enable RLS but allow service role to bypass
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

-- 6. Create simple owner policies
DROP POLICY IF EXISTS "owner_pipelines" ON pipelines;
CREATE POLICY "owner_pipelines" ON pipelines
    FOR ALL USING (user_email = current_setting('request.jwt.claims', true)::json->>'email');

DROP POLICY IF EXISTS "owner_emails" ON emails;
CREATE POLICY "owner_emails" ON emails
    FOR ALL USING (user_email = current_setting('request.jwt.claims', true)::json->>'email');

-- Done! Now refresh your app and click Sync.
SELECT 'Setup complete! Run sync in your app.' AS status;
