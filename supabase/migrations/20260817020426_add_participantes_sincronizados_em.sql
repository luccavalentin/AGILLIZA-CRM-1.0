-- Migration: Adicionar coluna participantes_sincronizados_em na tabela simulacoes
-- Data: Mon Aug 17 02:04:26 UTC 2026
-- Motivo: Evitar reprocessamento de participantes na integração HomeFin após a conclusão da simulação.

ALTER TABLE public.simulacoes
ADD COLUMN IF NOT EXISTS participantes_sincronizados_em timestamptz null;

COMMENT ON COLUMN public.simulacoes.participantes_sincronizados_em IS 'Marca o momento da última sincronização de participantes com a HomeFin para evitar loops na integração.';

GRANT SELECT, UPDATE ON public.simulacoes TO authenticated;
GRANT ALL ON public.simulacoes TO service_role;
