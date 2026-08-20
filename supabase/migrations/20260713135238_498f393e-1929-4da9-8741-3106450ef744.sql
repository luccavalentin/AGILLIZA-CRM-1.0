CREATE OR REPLACE FUNCTION public.portal_listar_atendentes(_cid uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT m.atendente_id,
           max(m.criada_em) AS ultima_em,
           (array_agg(CASE WHEN m.excluida_em IS NOT NULL THEN '' ELSE m.mensagem END ORDER BY m.criada_em DESC))[1] AS ultima_mensagem,
           count(*) FILTER (WHERE m.remetente_tipo = 'time' AND m.lida_em IS NULL) AS nao_lidas
      FROM public.cliente_app_mensagens m
     WHERE m.cliente_id = _cid AND m.atendente_id IS NOT NULL
     GROUP BY m.atendente_id
  ),
  resp AS (
    SELECT responsavel_id AS atendente_id
      FROM public.clientes
     WHERE id = _cid AND responsavel_id IS NOT NULL
  ),
  todos AS (
    SELECT atendente_id FROM base
    UNION
    SELECT atendente_id FROM resp
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'atendente_id', t.atendente_id,
    'nome', COALESCE(p.nome, 'Equipe'),
    'foto_url', p.foto_url,
    'ultima_em', b.ultima_em,
    'ultima_mensagem', b.ultima_mensagem,
    'nao_lidas', COALESCE(b.nao_lidas, 0)
  ) ORDER BY b.ultima_em DESC NULLS LAST), '[]'::jsonb)
  FROM todos t
  LEFT JOIN base b ON b.atendente_id = t.atendente_id
  LEFT JOIN public.profiles p ON p.id = t.atendente_id
  WHERE t.atendente_id IS NOT NULL;
$function$;