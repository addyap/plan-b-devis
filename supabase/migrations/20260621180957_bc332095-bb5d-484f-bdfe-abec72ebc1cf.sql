
-- Replace USING(true) with auth.uid() IS NOT NULL for write policies
DROP POLICY "Owner can manage business profile" ON public.business_profile;
CREATE POLICY "Owner can manage business profile" ON public.business_profile FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY "Owner can manage clients" ON public.clients;
CREATE POLICY "Owner can manage clients" ON public.clients FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY "Owner can manage presets" ON public.service_presets;
CREATE POLICY "Owner can manage presets" ON public.service_presets FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY "Owner can manage devis" ON public.devis;
CREATE POLICY "Owner can manage devis" ON public.devis FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY "Owner can manage devis lines" ON public.devis_lines;
CREATE POLICY "Owner can manage devis lines" ON public.devis_lines FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- next_devis_number: switch to SECURITY INVOKER (RLS-safe since user is authenticated)
DROP FUNCTION IF EXISTS public.next_devis_number();
CREATE OR REPLACE FUNCTION public.next_devis_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
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
REVOKE EXECUTE ON FUNCTION public.next_devis_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_devis_number() TO authenticated;
