-- Fix for "invalid input syntax for type uuid: "u_admin"" error

-- 1. Modify reports table
-- First, drop any foreign key constraint on user_id if it exists (names may vary, so we try common ones)
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_user_id_fkey;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS fk_user;

-- Change user_id column type to TEXT to support 'u_admin' and other custom IDs
ALTER TABLE public.reports ALTER COLUMN user_id TYPE TEXT;


-- 2. Modify activity_logs table (if it exists)
ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey;
ALTER TABLE public.activity_logs ALTER COLUMN user_id TYPE TEXT;


-- 3. Modify transactions table (for voided_by or similar fields)
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_voided_by_fkey;
ALTER TABLE public.transactions ALTER COLUMN voided_by TYPE TEXT;


-- 4. Modify users table id to TEXT if it isn't already (to allow inserting u_admin if needed in future)
-- Note: This might be risky if there are other dependencies, but necessary for consistency.
-- However, since we are just fixing the report save error, changing reports.user_id is the priority.
-- If users.id is UUID, we can't insert u_admin there anyway. 
-- The app uses local storage for u_admin, so we just need the foreign keys removed and columns converted to TEXT.

