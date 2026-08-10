ALTER TABLE public.cliente_documentos
  ADD COLUMN IF NOT EXISTS situacao_integracao text,
  ADD COLUMN IF NOT EXISTS integrado_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS erro_integracao text;