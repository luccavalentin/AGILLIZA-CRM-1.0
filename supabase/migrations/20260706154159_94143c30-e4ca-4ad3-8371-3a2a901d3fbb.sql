ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS utiliza_fgts boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fg_autorizacao_dados boolean NOT NULL DEFAULT false;