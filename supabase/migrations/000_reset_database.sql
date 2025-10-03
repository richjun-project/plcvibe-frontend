-- PLCVibe Database Reset Script
-- ⚠️ WARNING: This script will DROP ALL TABLES and DATA
-- Run this in Supabase SQL Editor to completely reset the database

-- Drop all policies
DROP POLICY IF EXISTS sessions_user_policy ON sessions;
DROP POLICY IF EXISTS ladder_programs_user_policy ON ladder_programs;
DROP POLICY IF EXISTS validation_results_user_policy ON validation_results;

-- Drop all triggers
DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
DROP TRIGGER IF EXISTS update_ladder_programs_updated_at ON ladder_programs;

-- Drop the trigger function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop all tables (CASCADE will drop dependent objects)
DROP TABLE IF EXISTS validation_results CASCADE;
DROP TABLE IF EXISTS ladder_programs CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;

-- Confirm reset complete
SELECT 'Database reset complete. Now run 001_sessions_and_programs.sql to recreate schema.' as status;
