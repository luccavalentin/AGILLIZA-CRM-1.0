
CREATE OR REPLACE FUNCTION public.portal_time_nota_interna(
  _cid uuid,
  _atendente uuid,
  _msg text,
  _anexo text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_corr uuid;
  v_resp uuid;
  v_at uuid;
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

  v_at := COALESCE(_atendente, v_resp);

  INSERT INTO public.cliente_app_mensagens
    (cliente_id, correspondente_id, atendente_id, remetente_tipo, remetente_id, mensagem, anexo_url, interna)
  VALUES
    (_cid, v_corr, v_at, 'time', v_resp, _msg, _anexo, true)
  RETURNING id, remetente_tipo, mensagem, anexo_url, lida_em, criada_em INTO v_nova;

  RETURN jsonb_build_object(
    'id', v_nova.id, 'remetente_tipo', v_nova.remetente_tipo, 'mensagem', v_nova.mensagem,
    'anexo_url', v_nova.anexo_url, 'lida_em', v_nova.lida_em, 'criada_em', v_nova.criada_em,
    'interna', true
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.portal_time_nota_interna(uuid, uuid, text, text) TO authenticated;
