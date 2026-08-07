
CREATE OR REPLACE FUNCTION public.portal_listar_mensagens(_cid uuid, _atendente uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH msgs AS (
    SELECT * FROM public.cliente_app_mensagens
     WHERE cliente_id = _cid
       AND atendente_id = _atendente
       AND COALESCE(interna, false) = false
     ORDER BY criada_em ASC LIMIT 500
  ), reac AS (
    SELECT r.mensagem_id,
           jsonb_agg(jsonb_build_object(
             'emoji', r.emoji,
             'count', r.total,
             'mine', r.mine,
             'usuarios', '[]'::jsonb
           ) ORDER BY r.total DESC, r.emoji) AS lista
    FROM (
      SELECT cr.mensagem_id, cr.emoji, count(*) AS total,
             bool_or(cr.usuario_id = _cid) AS mine
      FROM public.chat_reacoes cr
      WHERE cr.origem = 'cliente'
        AND cr.mensagem_id IN (SELECT id FROM msgs)
      GROUP BY cr.mensagem_id, cr.emoji
    ) r
    GROUP BY r.mensagem_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id, 'remetente_tipo', m.remetente_tipo,
    'mensagem', CASE WHEN m.excluida_em IS NOT NULL THEN '' ELSE m.mensagem END,
    'anexo_url', CASE WHEN m.excluida_em IS NOT NULL THEN NULL ELSE m.anexo_url END,
    'lida_em', m.lida_em, 'criada_em', m.criada_em,
    'editada_em', m.editada_em, 'excluida_em', m.excluida_em,
    'responde_a', m.responde_a,
    'citacao', CASE WHEN a.id IS NULL THEN NULL ELSE jsonb_build_object(
        'autor', CASE WHEN a.remetente_tipo = 'cliente' THEN 'Você' ELSE 'Atendente' END,
        'texto', CASE WHEN a.excluida_em IS NOT NULL THEN 'Mensagem excluída'
                      WHEN COALESCE(btrim(a.mensagem), '') = '' THEN 'Anexo'
                      ELSE a.mensagem END
      ) END,
    'reacoes', COALESCE(rc.lista, '[]'::jsonb)
  ) ORDER BY m.criada_em ASC), '[]'::jsonb)
  FROM msgs m
  LEFT JOIN public.cliente_app_mensagens a ON a.id = m.responde_a
  LEFT JOIN reac rc ON rc.mensagem_id = m.id;
$function$;

CREATE OR REPLACE FUNCTION public.portal_enviar_mensagem(_cid uuid, _corr uuid, _atendente uuid, _msg text, _anexo text, _responde_a uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_nova RECORD; v_resp uuid;
BEGIN
  SELECT id INTO v_resp FROM public.cliente_app_mensagens
   WHERE id = _responde_a AND cliente_id = _cid;

  INSERT INTO public.cliente_app_mensagens (cliente_id, correspondente_id, atendente_id, remetente_tipo, remetente_id, mensagem, anexo_url, responde_a)
  VALUES (_cid, _corr, _atendente, 'cliente', _cid, _msg, _anexo, v_resp)
  RETURNING id, remetente_tipo, mensagem, anexo_url, lida_em, criada_em INTO v_nova;

  RETURN jsonb_build_object(
    'id', v_nova.id, 'remetente_tipo', v_nova.remetente_tipo, 'mensagem', v_nova.mensagem,
    'anexo_url', v_nova.anexo_url, 'lida_em', v_nova.lida_em, 'criada_em', v_nova.criada_em
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.portal_reagir_mensagem(_cid uuid, _mensagem_id uuid, _emoji text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_ok boolean; v_id uuid;
BEGIN
  IF _emoji IS NULL OR btrim(_emoji) = '' OR length(_emoji) > 8 THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT true INTO v_ok FROM public.cliente_app_mensagens
   WHERE id = _mensagem_id AND cliente_id = _cid AND COALESCE(interna, false) = false;
  IF NOT COALESCE(v_ok, false) THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT id INTO v_id FROM public.chat_reacoes
   WHERE origem = 'cliente' AND mensagem_id = _mensagem_id
     AND usuario_id = _cid AND emoji = _emoji;

  IF v_id IS NOT NULL THEN
    DELETE FROM public.chat_reacoes WHERE id = v_id;
    RETURN jsonb_build_object('ok', true, 'toggled', 'removida');
  END IF;

  INSERT INTO public.chat_reacoes (origem, mensagem_id, usuario_id, emoji)
  VALUES ('cliente', _mensagem_id, _cid, _emoji);
  RETURN jsonb_build_object('ok', true, 'toggled', 'adicionada');
END;
$function$;

REVOKE ALL ON FUNCTION public.portal_reagir_mensagem(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.portal_enviar_mensagem(uuid, uuid, uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
