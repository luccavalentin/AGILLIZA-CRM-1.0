ALTER TABLE public.scan_ia_leituras
  ADD COLUMN IF NOT EXISTS tipo_documento_sugerido text,
  ADD COLUMN IF NOT EXISTS tipo_confirmado boolean NOT NULL DEFAULT false;