
ALTER TABLE public.cliente_app_mensagens
  ADD COLUMN IF NOT EXISTS editada_em timestamptz,
  ADD COLUMN IF NOT EXISTS excluida_em timestamptz,
  ADD COLUMN IF NOT EXISTS responde_a uuid REFERENCES public.cliente_app_mensagens(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cliente_app_mensagens_responde_a ON public.cliente_app_mensagens(responde_a);
