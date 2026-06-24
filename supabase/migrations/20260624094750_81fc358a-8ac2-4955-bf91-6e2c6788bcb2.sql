
-- 1) Drop the open "Public access" policies on every table
DROP POLICY IF EXISTS "Public access" ON public.business_profile;
DROP POLICY IF EXISTS "Public access" ON public.clients;
DROP POLICY IF EXISTS "Public access" ON public.devis;
DROP POLICY IF EXISTS "Public access" ON public.devis_lines;
DROP POLICY IF EXISTS "Public access" ON public.factures;
DROP POLICY IF EXISTS "Public access" ON public.facture_lines;
DROP POLICY IF EXISTS "Public access" ON public.service_presets;

-- 2) Revoke anon table grants (RLS + GRANT both required)
REVOKE ALL ON public.business_profile FROM anon;
REVOKE ALL ON public.clients          FROM anon;
REVOKE ALL ON public.devis            FROM anon;
REVOKE ALL ON public.devis_lines      FROM anon;
REVOKE ALL ON public.factures         FROM anon;
REVOKE ALL ON public.facture_lines    FROM anon;
REVOKE ALL ON public.service_presets  FROM anon;

-- Make sure authenticated still has table grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_profile TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devis            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devis_lines      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.factures         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facture_lines    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_presets  TO authenticated;
GRANT ALL ON public.business_profile, public.clients, public.devis, public.devis_lines,
            public.factures, public.facture_lines, public.service_presets TO service_role;

-- 3) Authenticated-only RLS policies
CREATE POLICY "Authenticated full access" ON public.business_profile FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.clients          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.devis            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.devis_lines      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.factures         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.facture_lines    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.service_presets  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4) Lock down the numbering helpers
REVOKE EXECUTE ON FUNCTION public.next_devis_number()   FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.next_facture_number() FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.next_devis_number()   TO authenticated;
GRANT  EXECUTE ON FUNCTION public.next_facture_number() TO authenticated;

-- 5) Add share_token + share_expires_at to devis
ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS share_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS share_expires_at timestamptz NULL;

CREATE UNIQUE INDEX IF NOT EXISTS devis_share_token_key ON public.devis(share_token);

-- 6) Tokenised public read helper (anon-callable, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_public_devis(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_devis   public.devis%ROWTYPE;
  v_lines   jsonb;
  v_client  jsonb;
  v_profile jsonb;
BEGIN
  IF p_token IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_devis
  FROM public.devis
  WHERE share_token = p_token
    AND status IN ('sent', 'accepted')
    AND (share_expires_at IS NULL OR share_expires_at > now())
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.sort_order), '[]'::jsonb)
    INTO v_lines
  FROM public.devis_lines l
  WHERE l.devis_id = v_devis.id;

  IF v_devis.client_id IS NOT NULL THEN
    SELECT to_jsonb(c) INTO v_client FROM public.clients c WHERE c.id = v_devis.client_id;
  END IF;

  SELECT to_jsonb(p) INTO v_profile FROM public.business_profile p LIMIT 1;
  IF v_profile IS NOT NULL THEN
    -- strip private banking fields from the public payload
    v_profile := v_profile - 'iban' - 'bic' - 'sender_email';
  END IF;

  RETURN jsonb_build_object(
    'devis',   to_jsonb(v_devis),
    'lines',   v_lines,
    'client',  v_client,
    'profile', v_profile
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_devis(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_devis(uuid) TO anon, authenticated;

-- 7) Rotate share token (authenticated only)
CREATE OR REPLACE FUNCTION public.rotate_devis_share_token(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.devis
     SET share_token = gen_random_uuid(),
         updated_at  = now()
   WHERE id = p_id
   RETURNING share_token INTO v_token;
  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_devis_share_token(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rotate_devis_share_token(uuid) TO authenticated;
