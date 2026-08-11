
ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_motivo text;

ALTER TABLE public.simulacoes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_motivo text;

CREATE INDEX IF NOT EXISTS idx_propostas_deleted_at ON public.propostas(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_simulacoes_deleted_at ON public.simulacoes(deleted_at) WHERE deleted_at IS NOT NULL;
