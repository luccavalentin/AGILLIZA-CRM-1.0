-- Soft delete columns em clientes, demandas e tasks
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_motivo text;

ALTER TABLE public.demandas
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_motivo text;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_motivo text;

CREATE INDEX IF NOT EXISTS idx_clientes_deleted_at ON public.clientes (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_demandas_deleted_at ON public.demandas (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at    ON public.tasks    (deleted_at) WHERE deleted_at IS NULL;