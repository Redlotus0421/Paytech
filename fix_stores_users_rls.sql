-- Migration: Fix RLS policies for stores and users tables
-- Run this SQL in your Supabase SQL Editor
--
-- ROOT CAUSE FIX: The stores (and users) table may have RLS enabled
-- without any permissive policies, causing select queries to return
-- empty arrays (no error!) — which makes stores invisible to the admin.

-- =====================================================
-- PART 1: Fix stores table RLS
-- =====================================================

-- Enable RLS (safe to run even if already enabled)
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow all store reads" ON stores;
DROP POLICY IF EXISTS "Allow all store inserts" ON stores;
DROP POLICY IF EXISTS "Allow all store updates" ON stores;
DROP POLICY IF EXISTS "Allow all store deletes" ON stores;
DROP POLICY IF EXISTS "Allow all store operations" ON stores;

-- Create permissive policies so the anon key can read/write stores
CREATE POLICY "Allow all store operations" ON stores
    FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- PART 2: Fix users table RLS
-- =====================================================

-- Enable RLS (safe to run even if already enabled)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow all user reads" ON users;
DROP POLICY IF EXISTS "Allow all user inserts" ON users;
DROP POLICY IF EXISTS "Allow all user updates" ON users;
DROP POLICY IF EXISTS "Allow all user deletes" ON users;
DROP POLICY IF EXISTS "Allow all user operations" ON users;

-- Create permissive policies so the anon key can read/write users
CREATE POLICY "Allow all user operations" ON users
    FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- PART 3: Also fix any other tables that may have the same issue
-- =====================================================

-- Reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all report operations" ON reports;
CREATE POLICY "Allow all report operations" ON reports
    FOR ALL USING (true) WITH CHECK (true);

-- Inventory
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all inventory operations" ON inventory;
CREATE POLICY "Allow all inventory operations" ON inventory
    FOR ALL USING (true) WITH CHECK (true);

-- Transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all transaction operations" ON transactions;
CREATE POLICY "Allow all transaction operations" ON transactions
    FOR ALL USING (true) WITH CHECK (true);

-- Activity Logs
ALTER TABLE IF EXISTS activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all activity_logs operations" ON activity_logs;
CREATE POLICY "Allow all activity_logs operations" ON activity_logs
    FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- PART 4: Verify
-- =====================================================

SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('stores', 'users', 'reports', 'inventory', 'transactions', 'activity_logs')
ORDER BY tablename, policyname;
