ALTER TABLE public.simulacoes ADD COLUMN IF NOT EXISTS participantes_sincronizados_em timestamptz null;
COMMENT ON COLUMN public.simulacoes.participantes_sincronizados_em IS 'Marca o momento da última sincronização de participantes com a HomeFin para evitar loops na integração.';
GRANT SELECT, UPDATE ON public.simulacoes TO authenticated;
GRANT ALL ON public.simulacoes TO service_role;