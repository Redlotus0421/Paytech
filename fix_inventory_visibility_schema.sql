-- Run this in your Supabase SQL Editor to add the missing column
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;
