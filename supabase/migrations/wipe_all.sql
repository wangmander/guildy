-- WIPE ALL DATA FOR CLEAN START
-- Run this in Supabase SQL Editor

-- Delete all pipelines and emails
TRUNCATE TABLE emails CASCADE;
TRUNCATE TABLE pipelines CASCADE;

-- Verify empty
SELECT 'Pipelines wiped' AS status, count(*) AS remaining FROM pipelines;
