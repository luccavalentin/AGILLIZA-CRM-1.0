GRANT EXECUTE ON FUNCTION public.portal_acompanhamento(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.portal_acompanhamento(uuid) FROM anon;