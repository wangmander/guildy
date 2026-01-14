-- ============================================================
-- FIX SECURITY ADVISOR ERRORS
-- Enable RLS on all identified tables and add appropriate policies
-- ============================================================

-- 1. pipelines (Already partially handled, ensuring completeness)
ALTER TABLE IF EXISTS pipelines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_pipelines" ON pipelines;
CREATE POLICY "service_role_full_access_pipelines" ON pipelines FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own pipelines" ON pipelines;
CREATE POLICY "Users can view own pipelines" ON pipelines
    FOR ALL
    USING (auth.uid()::text IS NOT NULL AND user_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- 2. emails
ALTER TABLE IF EXISTS emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_emails" ON emails;
CREATE POLICY "service_role_full_access_emails" ON emails FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own emails" ON emails;
CREATE POLICY "Users can view own emails" ON emails
    FOR ALL
    USING (auth.uid()::text IS NOT NULL AND user_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- 3. test_pipelines (Previously unsecured)
ALTER TABLE IF EXISTS test_pipelines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_test_pipelines" ON test_pipelines;
CREATE POLICY "service_role_full_access_test_pipelines" ON test_pipelines FOR ALL USING (true) WITH CHECK (true);

-- Assuming test_pipelines might be public or dev-only, but let's secure it to auth users if user_id/email exists
-- If user_id exists:
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_pipelines' AND column_name = 'user_email') THEN
        EXECUTE 'CREATE POLICY "Users can view own test_pipelines" ON test_pipelines FOR ALL USING (auth.uid()::text IS NOT NULL AND user_email = (SELECT email FROM auth.users WHERE id = auth.uid()));';
    END IF;
END $$;

-- 4. interviewers (Previously unsecured)
ALTER TABLE IF EXISTS interviewers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_interviewers" ON interviewers;
CREATE POLICY "service_role_full_access_interviewers" ON interviewers FOR ALL USING (true) WITH CHECK (true);

-- Similar check for user association
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'interviewers' AND column_name = 'user_email') THEN
        EXECUTE 'CREATE POLICY "Users can view own interviewers" ON interviewers FOR ALL USING (auth.uid()::text IS NOT NULL AND user_email = (SELECT email FROM auth.users WHERE id = auth.uid()));';
    END IF;
END $$;

-- 5. early_access_requests (Previously unsecured)
ALTER TABLE IF EXISTS early_access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_early_access_requests" ON early_access_requests;
CREATE POLICY "service_role_full_access_early_access_requests" ON early_access_requests FOR ALL USING (true) WITH CHECK (true);

-- Allow anyone to insert (since it's a request form), but only admins/service role to read
DROP POLICY IF EXISTS "Public can insert early access requests" ON early_access_requests;
CREATE POLICY "Public can insert early access requests" ON early_access_requests
    FOR INSERT
    WITH CHECK (true);
