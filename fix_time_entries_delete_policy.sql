-- Fix: Add missing DELETE policy for time_entries table
-- The delete operation silently fails because RLS has no DELETE policy
-- Run this SQL in your Supabase SQL Editor

-- Drop existing delete policy if it exists (safe to re-run)
DROP POLICY IF EXISTS "Allow time entry delete" ON time_entries;

-- Create DELETE policy to allow deletion of time entries
CREATE POLICY "Allow time entry delete" ON time_entries
    FOR DELETE USING (true);

-- Verify the policies
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'time_entries';
