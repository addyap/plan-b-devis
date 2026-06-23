
-- Make all app tables publicly accessible (no login).
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'business_profile','clients','devis','devis_lines','service_presets','factures','facture_lines'
  ])
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- Drop existing owner-only policies and replace with open ones.
DROP POLICY IF EXISTS "Owner can manage business profile" ON public.business_profile;
DROP POLICY IF EXISTS "Owner can manage clients" ON public.clients;
DROP POLICY IF EXISTS "Owner can manage devis" ON public.devis;
DROP POLICY IF EXISTS "Owner can manage devis lines" ON public.devis_lines;
DROP POLICY IF EXISTS "Owner can manage presets" ON public.service_presets;
DROP POLICY IF EXISTS "Owner can manage factures" ON public.factures;
DROP POLICY IF EXISTS "Owner can manage facture lines" ON public.facture_lines;

CREATE POLICY "Public access" ON public.business_profile FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON public.clients FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON public.devis FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON public.devis_lines FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON public.service_presets FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON public.factures FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON public.facture_lines FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
