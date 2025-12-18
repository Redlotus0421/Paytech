-- Drop the table if it exists to reset the schema (WARNING: This deletes existing expense data if any)
DROP TABLE IF EXISTS public.general_expenses;

-- Create general_expenses table with TEXT for recorded_by to support 'u_admin' and other non-UUID IDs
CREATE TABLE public.general_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    description TEXT,
    recorded_by TEXT, -- Changed from UUID to TEXT to support 'u_admin'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.general_expenses ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON public.general_expenses FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.general_expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.general_expenses FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.general_expenses FOR DELETE USING (true);

-- Add expenses column to reports table if it doesn't exist
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS expenses JSONB DEFAULT '[]'::jsonb;
