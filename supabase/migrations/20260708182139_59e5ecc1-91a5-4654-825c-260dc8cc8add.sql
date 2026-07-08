ALTER TABLE public.parametros_globais
ADD COLUMN IF NOT EXISTS backup_retencao_dias integer NOT NULL DEFAULT 2;