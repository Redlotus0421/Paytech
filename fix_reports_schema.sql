-- Add missing columns to reports table to support new features
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS sod_petty_cash_note TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS fund_in NUMERIC DEFAULT 0;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS cash_atm NUMERIC DEFAULT 0;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS operational_expenses_note TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS gcash_notebook NUMERIC;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS expenses JSONB DEFAULT '[]'::jsonb;

-- Ensure other potentially missing columns exist
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS pos_sales_details JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS custom_sales JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS bank_transfer_fees NUMERIC DEFAULT 0;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS operational_expenses NUMERIC DEFAULT 0;

-- Ensure fund_ins exists as it is still referenced (deprecated but sent as 0)
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS fund_ins NUMERIC DEFAULT 0;
