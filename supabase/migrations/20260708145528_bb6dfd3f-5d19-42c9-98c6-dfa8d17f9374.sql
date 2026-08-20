
CREATE OR REPLACE FUNCTION public.portal_listar_mensagens(_cid uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'remetente_tipo', remetente_tipo,
    'mensagem', CASE WHEN excluida_em IS NOT NULL THEN '' ELSE mensagem END,
    'anexo_url', CASE WHEN excluida_em IS NOT NULL THEN NULL ELSE anexo_url END,
    'lida_em', lida_em, 'criada_em', criada_em,
    'editada_em', editada_em, 'excluida_em', excluida_em
  ) ORDER BY criada_em ASC), '[]'::jsonb)
  FROM (SELECT * FROM public.cliente_app_mensagens WHERE cliente_id = _cid ORDER BY criada_em ASC LIMIT 500) m;
$function$
