-- Run this in the Supabase SQL Editor

ALTER TABLE pipelines 
ADD COLUMN IF NOT EXISTS predicted_stages JSONB;

-- Also ensure RLS allows inserts (should be fine for service role, but good to check)
GRANT ALL ON TABLE pipelines TO service_role;
GRANT ALL ON TABLE emails TO service_role;
