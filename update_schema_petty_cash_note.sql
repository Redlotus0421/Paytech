-- Add sod_petty_cash_note column to reports table if it doesn't exist
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS sod_petty_cash_note TEXT;
