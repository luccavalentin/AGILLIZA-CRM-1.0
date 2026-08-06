ALTER TABLE public.proposta_bancos
ADD COLUMN IF NOT EXISTS raw_response jsonb;

COMMENT ON COLUMN public.proposta_bancos.raw_response IS 'Retorno detalhado da integração bancária para esta proposta/banco.';