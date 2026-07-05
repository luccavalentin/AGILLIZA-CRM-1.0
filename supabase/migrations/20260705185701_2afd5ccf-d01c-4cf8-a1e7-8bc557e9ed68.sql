ALTER TABLE public.proposta_bancos
  ADD COLUMN IF NOT EXISTS situacao_banco text NOT NULL DEFAULT 'nao_enviado';

ALTER TABLE public.proposta_bancos DROP CONSTRAINT IF EXISTS proposta_bancos_situacao_banco_check;
ALTER TABLE public.proposta_bancos ADD CONSTRAINT proposta_bancos_situacao_banco_check
  CHECK (situacao_banco IN ('nao_enviado','em_analise','condicionado','aprovado','recusado','cancelado'));