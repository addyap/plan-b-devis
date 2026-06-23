
-- Clients: type + legal IDs
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_type text NOT NULL DEFAULT 'professionnel'
    CHECK (client_type IN ('particulier','professionnel')),
  ADD COLUMN IF NOT EXISTS siret text,
  ADD COLUMN IF NOT EXISTS vat_number text;

-- Devis line items: type, long description, per-line discount and VAT
ALTER TABLE public.devis_lines
  ADD COLUMN IF NOT EXISTS line_type text NOT NULL DEFAULT 'prestation'
    CHECK (line_type IN ('produit','prestation','forfait','remise')),
  ADD COLUMN IF NOT EXISTS details text,
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'percent'
    CHECK (discount_type IN ('percent','amount')),
  ADD COLUMN IF NOT EXISTS discount_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_rate numeric NOT NULL DEFAULT 20;

-- Devis: discounts, deposit, payment, conditions, legal mentions, signature
ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS global_discount_type text NOT NULL DEFAULT 'percent'
    CHECK (global_discount_type IN ('percent','amount')),
  ADD COLUMN IF NOT EXISTS global_discount_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_type text NOT NULL DEFAULT 'percent'
    CHECK (deposit_type IN ('percent','amount')),
  ADD COLUMN IF NOT EXISTS deposit_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_terms_preset text,
  ADD COLUMN IF NOT EXISTS payment_methods text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS conditions_notes text,
  ADD COLUMN IF NOT EXISTS legal_mentions text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS signature_client_name text,
  ADD COLUMN IF NOT EXISTS signature_date date;

-- Number format: DEV-YYYY-NNNN (4 digits, padded)
CREATE OR REPLACE FUNCTION public.next_devis_number()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  yr TEXT := to_char(CURRENT_DATE, 'YYYY');
  next_seq INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(devis_number, '-', 3) AS INT)), 0) + 1
    INTO next_seq
  FROM public.devis
  WHERE devis_number LIKE 'DEV-' || yr || '-%';
  RETURN 'DEV-' || yr || '-' || LPAD(next_seq::TEXT, 4, '0');
END;
$function$;
