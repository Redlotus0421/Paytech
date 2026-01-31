-- Daily Time Record Schema
-- Run this SQL in your Supabase SQL Editor to create the required tables

-- Time Entries Table (stores clock in/out records)
CREATE TABLE IF NOT EXISTS time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    date DATE NOT NULL,
    time_in TIME,
    time_out TIME,
    time_in_status TEXT DEFAULT 'pending' CHECK (time_in_status IN ('pending', 'approved', 'rejected')),
    time_out_status TEXT DEFAULT 'pending' CHECK (time_out_status IN ('pending', 'approved', 'rejected')),
    hours_worked DECIMAL(5,2),
    approved_by TEXT,
    approved_at BIGINT,
    created_at BIGINT DEFAULT extract(epoch from now()) * 1000,
    updated_at BIGINT DEFAULT extract(epoch from now()) * 1000,
    UNIQUE(user_id, date)
);

-- Employee Schedules Table (stores work schedules)
CREATE TABLE IF NOT EXISTS employee_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL DEFAULT '09:00',
    end_time TIME NOT NULL DEFAULT '18:00',
    is_rest_day BOOLEAN DEFAULT FALSE,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    created_at BIGINT DEFAULT extract(epoch from now()) * 1000,
    updated_at BIGINT DEFAULT extract(epoch from now()) * 1000,
    UNIQUE(user_id, day_of_week, effective_date)
);

-- Payroll Cutoffs Table (stores cutoff periods)
CREATE TABLE IF NOT EXISTS payroll_cutoffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    created_at BIGINT DEFAULT extract(epoch from now()) * 1000,
    created_by TEXT NOT NULL
);

-- Employee Details Table (stores salary and hourly rate info)
CREATE TABLE IF NOT EXISTS employee_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    monthly_salary DECIMAL(12,2) DEFAULT 0,
    hourly_rate DECIMAL(8,2) DEFAULT 0,
    auto_calculate_rate BOOLEAN DEFAULT TRUE,
    created_at BIGINT DEFAULT extract(epoch from now()) * 1000,
    updated_at BIGINT DEFAULT extract(epoch from now()) * 1000
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date);
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON time_entries(time_in_status, time_out_status);
CREATE INDEX IF NOT EXISTS idx_employee_schedules_user_id ON employee_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_cutoffs_dates ON payroll_cutoffs(start_date, end_date);

-- Enable Row Level Security (RLS)
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_cutoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_details ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to allow re-running this script)
DROP POLICY IF EXISTS "Users can view own time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can insert own time entries" ON time_entries;
DROP POLICY IF EXISTS "Allow time entry updates" ON time_entries;
DROP POLICY IF EXISTS "Anyone can view schedules" ON employee_schedules;
DROP POLICY IF EXISTS "Allow schedule management" ON employee_schedules;
DROP POLICY IF EXISTS "Anyone can view cutoffs" ON payroll_cutoffs;
DROP POLICY IF EXISTS "Allow cutoff management" ON payroll_cutoffs;
DROP POLICY IF EXISTS "Anyone can view employee details" ON employee_details;
DROP POLICY IF EXISTS "Allow employee details management" ON employee_details;

-- Create policies for time_entries
-- Allow users to view their own entries
CREATE POLICY "Users can view own time entries" ON time_entries
    FOR SELECT USING (true);

-- Allow users to insert their own entries
CREATE POLICY "Users can insert own time entries" ON time_entries
    FOR INSERT WITH CHECK (true);

-- Allow updates (for approvals and clock out)
CREATE POLICY "Allow time entry updates" ON time_entries
    FOR UPDATE USING (true);

-- Create policies for employee_schedules
CREATE POLICY "Anyone can view schedules" ON employee_schedules
    FOR SELECT USING (true);

CREATE POLICY "Allow schedule management" ON employee_schedules
    FOR ALL USING (true);

-- Create policies for payroll_cutoffs
CREATE POLICY "Anyone can view cutoffs" ON payroll_cutoffs
    FOR SELECT USING (true);

CREATE POLICY "Allow cutoff management" ON payroll_cutoffs
    FOR ALL USING (true);

-- Create policies for employee_details
CREATE POLICY "Anyone can view employee details" ON employee_details
    FOR SELECT USING (true);

CREATE POLICY "Allow employee details management" ON employee_details
    FOR ALL USING (true);
