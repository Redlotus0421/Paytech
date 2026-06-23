-- Migration: Per-unit barcode tracking for inventory items
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.inventory_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    barcode TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold', 'voided')),
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    sold_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_units_barcode ON public.inventory_units(barcode);
CREATE INDEX IF NOT EXISTS idx_inventory_units_inventory_id ON public.inventory_units(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_units_status ON public.inventory_units(status);
CREATE INDEX IF NOT EXISTS idx_inventory_units_store_id ON public.inventory_units(store_id);

ALTER TABLE public.inventory_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all inventory_units operations" ON public.inventory_units;
CREATE POLICY "Allow all inventory_units operations" ON public.inventory_units
    FOR ALL USING (true) WITH CHECK (true);
