-- ============================================================
-- CONSOLIDATED FIX (Run this once to fix everything)
-- 1. Creates email_processing_log table
-- 2. Enables RLS on all tables
-- 3. Adds policies for API (Service Role) and Users
-- ============================================================

-- 1. CREATE MISSING TABLE
CREATE TABLE IF NOT EXISTS email_processing_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    gmail_thread_id TEXT,
    gmail_message_id TEXT,
    from_email TEXT,
    from_domain TEXT,
    company_guess TEXT,
    subject TEXT,
    detected BOOLEAN DEFAULT FALSE,
    score REAL,
    strongest_hit REAL,
    matched_keywords TEXT[],
    rejection_reason TEXT,
    llm_called BOOLEAN,
    llm_is_recruiting BOOLEAN,
    llm_company TEXT,
    llm_role TEXT,
    llm_stage TEXT,
    created_pipeline_id UUID,
    action_taken TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_email_processing_log_user_email ON email_processing_log(user_email);
CREATE INDEX IF NOT EXISTS idx_email_processing_log_created_at ON email_processing_log(created_at DESC);

-- 2. ENABLE RLS ON ALL TABLES
ALTER TABLE IF EXISTS pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS email_processing_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS test_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS interviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS early_access_requests ENABLE ROW LEVEL SECURITY;

-- 3. CREATE POLICIES

-- >>> SERVICE ROLE (Full Access) <<<
DROP POLICY IF EXISTS "service_role_full_access_pipelines" ON pipelines;
CREATE POLICY "service_role_full_access_pipelines" ON pipelines FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_emails" ON emails;
CREATE POLICY "service_role_full_access_emails" ON emails FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_epl" ON email_processing_log;
CREATE POLICY "service_role_full_access_epl" ON email_processing_log FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_sync_runs" ON sync_runs;
CREATE POLICY "service_role_full_access_sync_runs" ON sync_runs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_test" ON test_pipelines;
CREATE POLICY "service_role_full_access_test" ON test_pipelines FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_interviewers" ON interviewers;
CREATE POLICY "service_role_full_access_interviewers" ON interviewers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_requests" ON early_access_requests;
CREATE POLICY "service_role_full_access_requests" ON early_access_requests FOR ALL USING (true) WITH CHECK (true);

-- >>> USER ACCESS (Own Data) <<<

-- Pipelines
DROP POLICY IF EXISTS "Users can view own pipelines" ON pipelines;
CREATE POLICY "Users can view own pipelines" ON pipelines
    FOR ALL USING (auth.uid()::text IS NOT NULL AND user_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Emails
DROP POLICY IF EXISTS "Users can view own emails" ON emails;
CREATE POLICY "Users can view own emails" ON emails
    FOR ALL USING (auth.uid()::text IS NOT NULL AND user_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Processing Logs
DROP POLICY IF EXISTS "Users can view own logs" ON email_processing_log;
CREATE POLICY "Users can view own logs" ON email_processing_log
    FOR ALL USING (auth.uid()::text IS NOT NULL AND user_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Sync Runs
DROP POLICY IF EXISTS "Users can view own sync runs" ON sync_runs;
CREATE POLICY "Users can view own sync runs" ON sync_runs
    FOR ALL USING (auth.uid()::text IS NOT NULL AND user_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Early Access (Public Insert)
DROP POLICY IF EXISTS "Public can insert early access requests" ON early_access_requests;
CREATE POLICY "Public can insert early access requests" ON early_access_requests FOR INSERT WITH CHECK (true);
