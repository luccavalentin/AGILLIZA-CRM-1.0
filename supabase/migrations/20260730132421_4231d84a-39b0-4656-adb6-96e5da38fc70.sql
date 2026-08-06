CREATE OR REPLACE FUNCTION public.portal_editar_mensagem(_cid uuid, _mensagem_id uuid, _texto text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_ok boolean;
BEGIN
  IF COALESCE(btrim(_texto), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Mensagem vazia.');
  END IF;

  UPDATE public.cliente_app_mensagens
     SET mensagem = btrim(_texto), editada_em = now()
   WHERE id = _mensagem_id
     AND cliente_id = _cid
     AND remetente_tipo = 'cliente'
     AND excluida_em IS NULL;

  GET DIAGNOSTICS v_ok = ROW_COUNT;
  IF NOT v_ok THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Mensagem não encontrada ou não pode ser editada.');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.portal_excluir_mensagem(_cid uuid, _mensagem_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_ok boolean;
BEGIN
  UPDATE public.cliente_app_mensagens
     SET excluida_em = now(), mensagem = '', anexo_url = NULL
   WHERE id = _mensagem_id
     AND cliente_id = _cid
     AND remetente_tipo = 'cliente'
     AND excluida_em IS NULL;

  GET DIAGNOSTICS v_ok = ROW_COUNT;
  IF NOT v_ok THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Mensagem não encontrada ou já excluída.');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.portal_editar_mensagem(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.portal_excluir_mensagem(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_editar_mensagem(uuid, uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.portal_excluir_mensagem(uuid, uuid) TO anon, authenticated, service_role;