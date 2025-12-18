-- Create general_expenses table
CREATE TABLE IF NOT EXISTS public.general_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    description TEXT,
    recorded_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.general_expenses ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust as needed for your security model)
CREATE POLICY "Enable read access for all users" ON public.general_expenses FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.general_expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.general_expenses FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.general_expenses FOR DELETE USING (true);

-- Add expenses column to reports table if it doesn't exist (for the detailed breakdown in reports)
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS expenses JSONB DEFAULT '[]'::jsonb;
