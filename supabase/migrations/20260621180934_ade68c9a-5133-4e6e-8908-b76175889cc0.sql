
-- Enums
CREATE TYPE public.vat_status AS ENUM ('franchise_293b', 'tva_registered');
CREATE TYPE public.devis_status AS ENUM ('draft', 'sent', 'accepted', 'declined', 'expired');
CREATE TYPE public.devis_language AS ENUM ('en', 'fr');

-- updated_at trigger fn
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- BUSINESS PROFILE (single row)
CREATE TABLE public.business_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name TEXT,
  trading_name TEXT DEFAULT 'Plan B Concept',
  legal_form TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  postcode TEXT,
  city TEXT,
  country TEXT DEFAULT 'France',
  siret TEXT,
  ape_code TEXT,
  rcs_or_rm TEXT,
  vat_status public.vat_status NOT NULL DEFAULT 'franchise_293b',
  vat_number TEXT,
  vat_rate NUMERIC NOT NULL DEFAULT 20,
  rc_pro_insurer TEXT,
  rc_pro_policy TEXT,
  decennale_insurer TEXT,
  insurance_geographic_cover TEXT,
  iban TEXT,
  bic TEXT,
  default_validity_days INTEGER NOT NULL DEFAULT 90,
  default_payment_terms TEXT,
  late_penalty_terms TEXT,
  default_footer_note TEXT,
  logo_url TEXT,
  brand_color TEXT DEFAULT '#0f1b3d',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_profile TO authenticated;
GRANT ALL ON public.business_profile TO service_role;
ALTER TABLE public.business_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can manage business profile" ON public.business_profile FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_business_profile_updated BEFORE UPDATE ON public.business_profile FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.business_profile (legal_name, trading_name, legal_form, country, vat_status, default_payment_terms, late_penalty_terms, default_footer_note)
VALUES ('Plan B Concept', 'Plan B Concept', 'Micro-entreprise', 'France', 'franchise_293b',
  'Acompte de 30% à la commande, solde à l''achèvement. Paiement par virement bancaire.',
  'En cas de retard de paiement, application d''une pénalité égale à trois fois le taux d''intérêt légal, ainsi qu''une indemnité forfaitaire de 40€ pour frais de recouvrement (art. L441-10 et D441-5 du Code de commerce).',
  'Plan B Concept — Maîtrise d''œuvre & Project Management — Côte d''Azur');

-- CLIENTS
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  postcode TEXT,
  city TEXT,
  country TEXT DEFAULT 'France',
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can manage clients" ON public.clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- SERVICE PRESETS
CREATE TABLE public.service_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label_en TEXT NOT NULL,
  label_fr TEXT NOT NULL,
  description TEXT,
  default_unit TEXT,
  default_rate NUMERIC DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_presets TO authenticated;
GRANT ALL ON public.service_presets TO service_role;
ALTER TABLE public.service_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can manage presets" ON public.service_presets FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.service_presets (label_en, label_fr, default_unit, sort_order) VALUES
('Owner''s Representative', 'Représentation du maître d''ouvrage', 'mois', 1),
('Villa Renovation Management', 'Gestion de rénovation de villa', 'forfait', 2),
('New Build Project Management', 'Gestion de projet construction neuve', 'forfait', 3),
('Construction Advisory', 'Conseil en construction', 'jour', 4),
('Site Monitoring & Quality Control', 'Suivi de chantier et contrôle qualité', 'visite', 5),
('Bilingual Client Liaison', 'Liaison client bilingue', 'heure', 6),
('Project management fee (% of works)', 'Honoraires de gestion (% des travaux)', '%', 7),
('Feasibility study / quote analysis', 'Étude de faisabilité / analyse de devis', 'forfait', 8);

-- DEVIS
CREATE TABLE public.devis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_number TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  validity_until DATE NOT NULL,
  status public.devis_status NOT NULL DEFAULT 'draft',
  language public.devis_language NOT NULL DEFAULT 'en',
  project_description TEXT,
  project_start DATE,
  project_duration TEXT,
  subtotal_ht NUMERIC NOT NULL DEFAULT 0,
  vat_amount NUMERIC NOT NULL DEFAULT 0,
  total_ttc NUMERIC NOT NULL DEFAULT 0,
  deposit_amount NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devis TO authenticated;
GRANT ALL ON public.devis TO service_role;
ALTER TABLE public.devis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can manage devis" ON public.devis FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_devis_updated BEFORE UPDATE ON public.devis FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- DEVIS LINES
CREATE TABLE public.devis_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id UUID NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT,
  unit_price_ht NUMERIC NOT NULL DEFAULT 0,
  line_total_ht NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devis_lines TO authenticated;
GRANT ALL ON public.devis_lines TO service_role;
ALTER TABLE public.devis_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can manage devis lines" ON public.devis_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Next devis number function
CREATE OR REPLACE FUNCTION public.next_devis_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  yr TEXT := to_char(CURRENT_DATE, 'YYYY');
  next_seq INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(devis_number, '-', 3) AS INT)), 0) + 1
    INTO next_seq
  FROM public.devis
  WHERE devis_number LIKE 'DEV-' || yr || '-%';
  RETURN 'DEV-' || yr || '-' || LPAD(next_seq::TEXT, 3, '0');
END; $$;
GRANT EXECUTE ON FUNCTION public.next_devis_number() TO authenticated;

-- Storage policies for logos bucket (public read, authenticated write)
CREATE POLICY "Public read logos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'logos');
CREATE POLICY "Owner upload logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos');
CREATE POLICY "Owner update logos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'logos');
CREATE POLICY "Owner delete logos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'logos');
