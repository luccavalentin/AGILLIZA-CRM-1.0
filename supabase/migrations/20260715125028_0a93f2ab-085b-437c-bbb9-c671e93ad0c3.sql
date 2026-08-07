ALTER TABLE public.simulacoes ADD COLUMN IF NOT EXISTS agrupador_id uuid;
CREATE INDEX IF NOT EXISTS simulacoes_agrupador_id_idx ON public.simulacoes(agrupador_id);