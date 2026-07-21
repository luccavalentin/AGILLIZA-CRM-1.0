
CREATE OR REPLACE FUNCTION public.cliente_msg_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_nome_cliente text;
  v_preview text;
  v_link text;
  r RECORD;
BEGIN
  -- Só notifica no sentido cliente -> time. Mensagens do próprio time já
  -- geram alerta no PWA do cliente via notificar_cliente_portal.
  IF NEW.remetente_tipo <> 'cliente' THEN
    RETURN NEW;
  END IF;

  SELECT nome INTO v_nome_cliente FROM public.clientes WHERE id = NEW.cliente_id;
  v_preview := LEFT(COALESCE(NEW.mensagem, 'Anexo'), 200);
  v_link := '/crm/chat?c=' || NEW.cliente_id::text;

  -- Atendente-dono da thread
  IF NEW.atendente_id IS NOT NULL THEN
    PERFORM public.emitir_notificacao(
      NEW.atendente_id, NEW.correspondente_id, 'chat.cliente',
      'Nova mensagem de ' || COALESCE(v_nome_cliente, 'cliente'),
      v_preview, v_link
    );
  END IF;

  -- Participantes convidados da mesma thread (exceto o dono já notificado)
  FOR r IN
    SELECT DISTINCT p.usuario_id
      FROM public.crm_chat_participantes p
     WHERE p.cliente_id = NEW.cliente_id
       AND (NEW.atendente_id IS NULL OR p.atendente_id = NEW.atendente_id)
       AND p.usuario_id IS DISTINCT FROM NEW.atendente_id
  LOOP
    PERFORM public.emitir_notificacao(
      r.usuario_id, NEW.correspondente_id, 'chat.cliente',
      'Nova mensagem de ' || COALESCE(v_nome_cliente, 'cliente'),
      v_preview, v_link
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cliente_msg_after_insert ON public.cliente_app_mensagens;
CREATE TRIGGER trg_cliente_msg_after_insert
AFTER INSERT ON public.cliente_app_mensagens
FOR EACH ROW
EXECUTE FUNCTION public.cliente_msg_after_insert();
