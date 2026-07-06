CREATE OR REPLACE FUNCTION public.portal_minhas_propostas(_cid uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'banco', nome_banco, 'produto', produto, 'valor', valor_financiamento,
    'status', status, 'enviada_em', enviada_em
  ) ORDER BY created_at DESC), '[]'::jsonb)
  FROM public.propostas WHERE cliente_id = _cid;
$function$;