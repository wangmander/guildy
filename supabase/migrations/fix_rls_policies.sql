-- Grants full access to pipelines and emails for authenticated users
-- Use this if RLS is effectively hiding data from the dashboard

-- PIPELINES
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pipelines"
ON pipelines FOR SELECT
USING (auth.uid() = (select id from auth.users where email = user_email limit 1) OR user_email = auth.email());

CREATE POLICY "Users can insert their own pipelines"
ON pipelines FOR INSERT
WITH CHECK (auth.uid() = (select id from auth.users where email = user_email limit 1) OR user_email = auth.email());

CREATE POLICY "Users can update their own pipelines"
ON pipelines FOR UPDATE
USING (auth.uid() = (select id from auth.users where email = user_email limit 1) OR user_email = auth.email());

-- EMAILS
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own emails"
ON emails FOR SELECT
USING (auth.uid() = (select id from auth.users where email = user_email limit 1) OR user_email = auth.email());

-- SYNC RUNS
ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync runs"
ON sync_runs FOR SELECT
USING (auth.uid() = (select id from auth.users where email = user_email limit 1) OR user_email = auth.email());

-- Grant service role bypass just in case
GRANT ALL ON pipelines TO service_role;
GRANT ALL ON emails TO service_role;
GRANT ALL ON sync_runs TO service_role;
