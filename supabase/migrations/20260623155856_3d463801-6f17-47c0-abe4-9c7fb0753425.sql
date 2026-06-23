
-- Maîtrise d'œuvre fields on devis
ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS project_name text,
  ADD COLUMN IF NOT EXISTS site_address_line1 text,
  ADD COLUMN IF NOT EXISTS site_address_line2 text,
  ADD COLUMN IF NOT EXISTS site_postcode text,
  ADD COLUMN IF NOT EXISTS site_city text,
  ADD COLUMN IF NOT EXISTS site_country text,
  ADD COLUMN IF NOT EXISTS operation_type text,
  ADD COLUMN IF NOT EXISTS surface_m2 numeric,
  ADD COLUMN IF NOT EXISTS works_budget_ht numeric,
  ADD COLUMN IF NOT EXISTS mission_phases text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS payment_schedule jsonb NOT NULL DEFAULT '[]'::jsonb;

-- MOE mission fields on devis_lines
ALTER TABLE public.devis_lines
  ADD COLUMN IF NOT EXISTS mission_code text,
  ADD COLUMN IF NOT EXISTS pricing_mode text NOT NULL DEFAULT 'amount',
  ADD COLUMN IF NOT EXISTS percent_of_budget numeric;
