CREATE TABLE IF NOT EXISTS public.transaction_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default categories
INSERT INTO public.transaction_categories (name) VALUES
('Printing Services'),
('Repair Services'),
('Accessories'),
('Coffee'),
('Other')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.transaction_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.transaction_categories FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.transaction_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable delete access for all users" ON public.transaction_categories FOR DELETE USING (true);
