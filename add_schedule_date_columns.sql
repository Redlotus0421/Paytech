-- Migration: Fix employee_schedules and time_entries tables
-- Run this SQL in your Supabase SQL Editor

-- =====================================================
-- PART 1: Fix user_id type (must be TEXT, not UUID, to support app's string IDs)
-- =====================================================

-- Fix time_entries table
ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_user_id_fkey;
ALTER TABLE time_entries ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Fix employee_schedules table
ALTER TABLE employee_schedules DROP CONSTRAINT IF EXISTS employee_schedules_user_id_fkey;
ALTER TABLE employee_schedules ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- =====================================================
-- PART 2: Ensure all columns exist in employee_schedules
-- =====================================================

-- Add effective_date column if it doesn't exist
ALTER TABLE employee_schedules ADD COLUMN IF NOT EXISTS effective_date DATE DEFAULT CURRENT_DATE;

-- Add end_date column if it doesn't exist  
ALTER TABLE employee_schedules ADD COLUMN IF NOT EXISTS end_date DATE;

-- Add created_at column if it doesn't exist
ALTER TABLE employee_schedules ADD COLUMN IF NOT EXISTS created_at BIGINT DEFAULT extract(epoch from now()) * 1000;

-- Add updated_at column if it doesn't exist
ALTER TABLE employee_schedules ADD COLUMN IF NOT EXISTS updated_at BIGINT DEFAULT extract(epoch from now()) * 1000;

-- =====================================================
-- PART 3: Fix RLS policies - drop all and recreate
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view schedules" ON employee_schedules;
DROP POLICY IF EXISTS "Allow schedule management" ON employee_schedules;
DROP POLICY IF EXISTS "Allow schedule insert" ON employee_schedules;
DROP POLICY IF EXISTS "Allow schedule update" ON employee_schedules;
DROP POLICY IF EXISTS "Allow schedule delete" ON employee_schedules;

-- Recreate policies with explicit permissions
CREATE POLICY "Allow all schedule operations" ON employee_schedules
    FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- PART 4: Fix unique constraints
-- =====================================================

-- Drop old unique constraint if exists
ALTER TABLE employee_schedules DROP CONSTRAINT IF EXISTS employee_schedules_user_id_day_of_week_key;
ALTER TABLE employee_schedules DROP CONSTRAINT IF EXISTS employee_schedules_user_id_day_of_week_effective_date_key;

-- Create the correct unique constraint
ALTER TABLE employee_schedules 
ADD CONSTRAINT employee_schedules_user_id_day_of_week_effective_date_key 
UNIQUE (user_id, day_of_week, effective_date);

-- Create index for effective_date for better query performance
CREATE INDEX IF NOT EXISTS idx_employee_schedules_effective_date 
ON employee_schedules(effective_date);

-- =====================================================
-- PART 5: Verify the changes
-- =====================================================

SELECT 'employee_schedules columns:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'employee_schedules'
ORDER BY ordinal_position;

SELECT 'RLS policies:' as info;
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'employee_schedules';
