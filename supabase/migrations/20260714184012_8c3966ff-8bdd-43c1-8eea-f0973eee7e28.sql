GRANT EXECUTE ON FUNCTION public.portal_acompanhamento(uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.portal_acompanhamento(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.portal_acompanhamento(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.portal_acompanhamento(uuid) FROM anon;