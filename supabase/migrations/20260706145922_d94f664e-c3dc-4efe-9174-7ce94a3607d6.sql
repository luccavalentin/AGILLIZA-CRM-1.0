ALTER TABLE public.proposta_envolvidos
  ADD COLUMN IF NOT EXISTS tipo_situacao text NOT NULL DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS utiliza_fgts boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fg_autorizacao_dados boolean NOT NULL DEFAULT false;