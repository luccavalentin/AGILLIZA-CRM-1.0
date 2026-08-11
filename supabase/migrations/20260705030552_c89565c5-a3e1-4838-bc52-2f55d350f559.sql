-- Server function to send a message to the client as the team, and mark client messages as read
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

  INSERT INTO public.cliente_app_mensagens (cliente_id, correspondente_id, remetente_tipo, remetente_id, mensagem, anexo_url)
  VALUES (_cid, v_corr, 'time', v_resp, _msg, _anexo)
  RETURNING id, remetente_tipo, mensagem, anexo_url, lida_em, criada_em INTO v_nova;

  -- Notifica o cliente no App
  PERFORM public.notificar_cliente_portal(_cid, v_corr, 'mensagem.time', 'Nova mensagem da sua equipe',
    'Você recebeu uma nova mensagem no App do Cliente.', '/cliente');

  RETURN jsonb_build_object(
    'id', v_nova.id, 'remetente_tipo', v_nova.remetente_tipo, 'mensagem', v_nova.mensagem,
    'anexo_url', v_nova.anexo_url, 'lida_em', v_nova.lida_em, 'criada_em', v_nova.criada_em
  );
END;
$function$;

-- Mark client-originated messages as read (team side)
CREATE OR REPLACE FUNCTION public.portal_time_marcar_lidas(_cid uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.cliente_app_mensagens SET lida_em = now()
  WHERE cliente_id = _cid AND remetente_tipo = 'cliente' AND lida_em IS NULL
    AND correspondente_id = public.correspondente_do_usuario(auth.uid());
$function$;

-- Enable realtime on the client chat table
ALTER TABLE public.cliente_app_mensagens REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cliente_app_mensagens;