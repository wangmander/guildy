-- ============================================================
-- ENABLE RLS ON ALL TABLES (Final Fix - 2026-01-21)
-- Run this in Supabase SQL Editor to fix all RLS warnings
-- ============================================================

-- ============================================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE IF EXISTS pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS email_processing_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS test_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS interviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS early_access_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. CREATE RLS POLICIES FOR: pipelines
-- ============================================================

DROP POLICY IF EXISTS "service_role_full_access_pipelines" ON pipelines;
CREATE POLICY "service_role_full_access_pipelines" ON pipelines 
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own pipelines" ON pipelines;
CREATE POLICY "Users can view own pipelines" ON pipelines
  FOR ALL USING (
    auth.uid()::text IS NOT NULL 
    AND user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ============================================================
-- 3. CREATE RLS POLICIES FOR: emails
-- ============================================================

DROP POLICY IF EXISTS "service_role_full_access_emails" ON emails;
CREATE POLICY "service_role_full_access_emails" ON emails 
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own emails" ON emails;
CREATE POLICY "Users can view own emails" ON emails
  FOR ALL USING (
    auth.uid()::text IS NOT NULL 
    AND user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ============================================================
-- 4. CREATE RLS POLICIES FOR: email_processing_log
-- ============================================================

DROP POLICY IF EXISTS "service_role_full_access_epl" ON email_processing_log;
CREATE POLICY "service_role_full_access_epl" ON email_processing_log 
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own logs" ON email_processing_log;
CREATE POLICY "Users can view own logs" ON email_processing_log
  FOR ALL USING (
    auth.uid()::text IS NOT NULL 
    AND user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ============================================================
-- 5. CREATE RLS POLICIES FOR: sync_runs
-- ============================================================

DROP POLICY IF EXISTS "service_role_full_access_sync_runs" ON sync_runs;
CREATE POLICY "service_role_full_access_sync_runs" ON sync_runs 
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own sync runs" ON sync_runs;
CREATE POLICY "Users can view own sync runs" ON sync_runs
  FOR ALL USING (
    auth.uid()::text IS NOT NULL 
    AND user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ============================================================
-- 6. CREATE RLS POLICIES FOR: test_pipelines
-- ============================================================

DROP POLICY IF EXISTS "service_role_full_access_test_pipelines" ON test_pipelines;
CREATE POLICY "service_role_full_access_test_pipelines" ON test_pipelines 
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 7. CREATE RLS POLICIES FOR: interviewers
-- ============================================================

DROP POLICY IF EXISTS "service_role_full_access_interviewers" ON interviewers;
CREATE POLICY "service_role_full_access_interviewers" ON interviewers 
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 8. CREATE RLS POLICIES FOR: early_access_requests
-- ============================================================

DROP POLICY IF EXISTS "service_role_full_access_early_access_requests" ON early_access_requests;
CREATE POLICY "service_role_full_access_early_access_requests" ON early_access_requests 
  FOR ALL USING (true) WITH CHECK (true);

-- Allow public inserts for early access form
DROP POLICY IF EXISTS "Public can insert early access requests" ON early_access_requests;
CREATE POLICY "Public can insert early access requests" ON early_access_requests 
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- DONE! All tables now have RLS enabled with appropriate policies
-- ============================================================
