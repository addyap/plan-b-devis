
ALTER TABLE public.business_profile ADD COLUMN IF NOT EXISTS sender_email TEXT;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS last_email_error TEXT;

DO $$ BEGIN
  CREATE TYPE public.facture_status AS ENUM ('draft','sent','paid','overdue','cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.factures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_number TEXT NOT NULL UNIQUE,
  devis_id UUID REFERENCES public.devis(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  status public.facture_status NOT NULL DEFAULT 'draft',
  language TEXT NOT NULL DEFAULT 'en',
  project_description TEXT,
  project_start DATE,
  project_duration TEXT,
  subtotal_ht NUMERIC NOT NULL DEFAULT 0,
  vat_amount NUMERIC NOT NULL DEFAULT 0,
  total_ttc NUMERIC NOT NULL DEFAULT 0,
  deposit_amount NUMERIC,
  notes TEXT,
  sent_at TIMESTAMPTZ,
  last_email_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.factures TO authenticated;
GRANT ALL ON public.factures TO service_role;
ALTER TABLE public.factures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner can manage factures" ON public.factures;
CREATE POLICY "Owner can manage factures" ON public.factures FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.facture_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id UUID NOT NULL REFERENCES public.factures(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT,
  unit_price_ht NUMERIC NOT NULL DEFAULT 0,
  line_total_ht NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facture_lines TO authenticated;
GRANT ALL ON public.facture_lines TO service_role;
ALTER TABLE public.facture_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner can manage facture lines" ON public.facture_lines;
CREATE POLICY "Owner can manage facture lines" ON public.facture_lines FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE OR REPLACE TRIGGER factures_updated_at BEFORE UPDATE ON public.factures FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.next_facture_number()
RETURNS TEXT LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  yr TEXT := to_char(CURRENT_DATE, 'YYYY');
  next_seq INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(facture_number, '-', 3) AS INT)), 0) + 1
    INTO next_seq
  FROM public.factures
  WHERE facture_number LIKE 'FAC-' || yr || '-%';
  RETURN 'FAC-' || yr || '-' || LPAD(next_seq::TEXT, 3, '0');
END; $$;
