GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulacoes TO authenticated;
GRANT ALL ON public.simulacoes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulacao_bancos TO authenticated;
GRANT ALL ON public.simulacao_bancos TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.propostas TO authenticated;
GRANT ALL ON public.propostas TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposta_bancos TO authenticated;
GRANT ALL ON public.proposta_bancos TO service_role;