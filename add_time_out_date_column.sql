-- Migration: Add time_out_date column to time_entries table
-- Run this SQL in your Supabase SQL Editor

-- =====================================================
-- Add time_out_date column for tracking overnight shifts
-- =====================================================

-- Add time_out_date column if it doesn't exist
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS time_out_date DATE;

-- Update existing entries: set time_out_date to same as date for entries that have time_out
-- This assumes existing entries were same-day clock outs
UPDATE time_entries 
SET time_out_date = date::DATE
WHERE time_out IS NOT NULL AND time_out_date IS NULL;

-- =====================================================
-- Verify the changes
-- =====================================================

SELECT 'time_entries columns:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'time_entries'
ORDER BY ordinal_position;
