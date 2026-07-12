ALTER TABLE public.cliente_documento_pastas
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.cliente_documento_pastas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_cliente_documento_pastas_parent
  ON public.cliente_documento_pastas(parent_id);