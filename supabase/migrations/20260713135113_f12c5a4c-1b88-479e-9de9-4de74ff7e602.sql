-- 1) Coluna de atendente (dono da thread) + índice
ALTER TABLE public.cliente_app_mensagens ADD COLUMN IF NOT EXISTS atendente_id uuid;

CREATE INDEX IF NOT EXISTS idx_cliente_app_mensagens_atendente
  ON public.cliente_app_mensagens (cliente_id, atendente_id, criada_em);

-- 2) Backfill: mensagens da equipe pertencem a quem enviou
UPDATE public.cliente_app_mensagens
   SET atendente_id = remetente_id
 WHERE remetente_tipo = 'time' AND atendente_id IS NULL AND remetente_id IS NOT NULL;

-- 2b) Mensagens do cliente: atendente da mensagem 'time' mais próxima; fallback responsável
UPDATE public.cliente_app_mensagens c
   SET atendente_id = COALESCE(
     (SELECT t.remetente_id
        FROM public.cliente_app_mensagens t
       WHERE t.cliente_id = c.cliente_id
         AND t.remetente_tipo = 'time'
         AND t.remetente_id IS NOT NULL
       ORDER BY abs(extract(epoch FROM (t.criada_em - c.criada_em))) ASC
       LIMIT 1),
     (SELECT cl.responsavel_id FROM public.clientes cl WHERE cl.id = c.cliente_id)
   )
 WHERE c.remetente_tipo = 'cliente' AND c.atendente_id IS NULL;

-- 3) RPC: equipe responde -> grava atendente = quem respondeu
CREATE OR REPLACE FUNCTION public.portal_time_responder(_cid uuid, _msg text, _anexo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_corr uuid;
  v_resp uuid;
  v_nova RECORD;
BEGIN
  v_resp := auth.uid();
  SELECT correspondente_id INTO v_corr FROM public.clientes WHERE id = _cid;
  IF v_corr IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;
  IF v_corr <> public.correspondente_do_usuario(v_resp) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  INSERT INTO public.cliente_app_mensagens (cliente_id, correspondente_id, atendente_id, remetente_tipo, remetente_id, mensagem, anexo_url)
  VALUES (_cid, v_corr, v_resp, 'time', v_resp, _msg, _anexo)
  RETURNING id, remetente_tipo, mensagem, anexo_url, lida_em, criada_em INTO v_nova;

  PERFORM public.notificar_cliente_portal(_cid, v_corr, 'mensagem.time', 'Nova mensagem da sua equipe',
    'Você recebeu uma nova mensagem no App do Cliente.', '/cliente');

  RETURN jsonb_build_object(
    'id', v_nova.id, 'remetente_tipo', v_nova.remetente_tipo, 'mensagem', v_nova.mensagem,
    'anexo_url', v_nova.anexo_url, 'lida_em', v_nova.lida_em, 'criada_em', v_nova.criada_em
  );
END;
$function$;

-- 4) RPC: equipe marca lidas -> só a thread do próprio atendente
CREATE OR REPLACE FUNCTION public.portal_time_marcar_lidas(_cid uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.cliente_app_mensagens SET lida_em = now()
  WHERE cliente_id = _cid AND remetente_tipo = 'cliente' AND lida_em IS NULL
    AND atendente_id = auth.uid()
    AND correspondente_id = public.correspondente_do_usuario(auth.uid());
$function$;

-- 5) RPC: cliente envia -> escolhe atendente da thread
DROP FUNCTION IF EXISTS public.portal_enviar_mensagem(uuid, uuid, text, text);
CREATE OR REPLACE FUNCTION public.portal_enviar_mensagem(_cid uuid, _corr uuid, _atendente uuid, _msg text, _anexo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_nova RECORD;
BEGIN
  INSERT INTO public.cliente_app_mensagens (cliente_id, correspondente_id, atendente_id, remetente_tipo, remetente_id, mensagem, anexo_url)
  VALUES (_cid, _corr, _atendente, 'cliente', _cid, _msg, _anexo)
  RETURNING id, remetente_tipo, mensagem, anexo_url, lida_em, criada_em INTO v_nova;
  RETURN jsonb_build_object(
    'id', v_nova.id, 'remetente_tipo', v_nova.remetente_tipo, 'mensagem', v_nova.mensagem,
    'anexo_url', v_nova.anexo_url, 'lida_em', v_nova.lida_em, 'criada_em', v_nova.criada_em
  );
END;
$function$;

-- 6) RPC: cliente lista mensagens de uma thread específica
DROP FUNCTION IF EXISTS public.portal_listar_mensagens(uuid);
CREATE OR REPLACE FUNCTION public.portal_listar_mensagens(_cid uuid, _atendente uuid)
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
  FROM (SELECT * FROM public.cliente_app_mensagens
         WHERE cliente_id = _cid AND atendente_id = _atendente
         ORDER BY criada_em ASC LIMIT 500) m;
$function$;

-- 7) RPC: cliente lista atendentes com quem conversa
CREATE OR REPLACE FUNCTION public.portal_listar_atendentes(_cid uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'atendente_id', atendente_id,
    'nome', COALESCE(nome, 'Equipe'),
    'ultima_em', ultima_em,
    'ultima_mensagem', ultima_mensagem,
    'nao_lidas', nao_lidas
  ) ORDER BY ultima_em DESC), '[]'::jsonb)
  FROM (
    SELECT m.atendente_id,
           p.nome,
           max(m.criada_em) AS ultima_em,
           (array_agg(CASE WHEN m.excluida_em IS NOT NULL THEN '' ELSE m.mensagem END ORDER BY m.criada_em DESC))[1] AS ultima_mensagem,
           count(*) FILTER (WHERE m.remetente_tipo = 'time' AND m.lida_em IS NULL) AS nao_lidas
      FROM public.cliente_app_mensagens m
      LEFT JOIN public.profiles p ON p.id = m.atendente_id
     WHERE m.cliente_id = _cid AND m.atendente_id IS NOT NULL
     GROUP BY m.atendente_id, p.nome
  ) t;
$function$;