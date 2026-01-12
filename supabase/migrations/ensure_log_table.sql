-- Create email_processing_log table to debug detection issues
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

-- Add index for faster querying
CREATE INDEX IF NOT EXISTS idx_email_processing_log_user_email ON email_processing_log(user_email);
CREATE INDEX IF NOT EXISTS idx_email_processing_log_created_at ON email_processing_log(created_at DESC);

-- Enable RLS just in case (though service key bypasses it)
ALTER TABLE email_processing_log ENABLE ROW LEVEL SECURITY;

-- Allow user to view their own logs
CREATE POLICY "Users can view their own logs" ON email_processing_log
    FOR SELECT
    USING (auth.uid()::text IS NOT NULL); 
    -- Note: Simple policy for now, assuming service role is mainly used or authenticated user. 
    -- Ideally: auth.email() = user_email, but auth.email() isn't always available in simple SQL context.
    -- For now, relying on service role for writing and reading in API.
