-- Participantes de conversas do chat do cliente (compartilhamento de thread).
-- Cada thread é o par (cliente_id, atendente_id "dono"). Um participante
-- (usuario_id) ganha acesso à conversa e histórico e pode responder.
CREATE TABLE public.crm_chat_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  atendente_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, atendente_id, usuario_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_chat_participantes TO authenticated;
GRANT ALL ON public.crm_chat_participantes TO service_role;

ALTER TABLE public.crm_chat_participantes ENABLE ROW LEVEL SECURITY;

-- Membros da equipe do mesmo correspondente do cliente podem ver/gerenciar
-- os participantes das conversas (a "privacidade" da thread é controlada na
-- aplicação; aqui garantimos apenas o escopo do correspondente).
CREATE POLICY "Equipe ve participantes do chat"
  ON public.crm_chat_participantes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = crm_chat_participantes.cliente_id
        AND c.correspondente_id = public.correspondente_do_usuario(( SELECT auth.uid() ))
    )
  );

CREATE POLICY "Equipe gerencia participantes do chat (insert)"
  ON public.crm_chat_participantes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = crm_chat_participantes.cliente_id
        AND c.correspondente_id = public.correspondente_do_usuario(( SELECT auth.uid() ))
    )
  );

CREATE POLICY "Equipe gerencia participantes do chat (delete)"
  ON public.crm_chat_participantes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = crm_chat_participantes.cliente_id
        AND c.correspondente_id = public.correspondente_do_usuario(( SELECT auth.uid() ))
    )
  );

-- Helper: o usuário participa (dono ou convidado) da thread?
CREATE OR REPLACE FUNCTION public.usuario_participa_chat(_uid uuid, _cliente_id uuid, _atendente_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _uid = _atendente_id OR EXISTS (
    SELECT 1 FROM public.crm_chat_participantes p
    WHERE p.cliente_id = _cliente_id
      AND p.atendente_id = _atendente_id
      AND p.usuario_id = _uid
  );
$$;

-- Responder em uma thread específica (do dono _atendente), permitindo que
-- participantes convidados também respondam na mesma conversa.
CREATE OR REPLACE FUNCTION public.portal_time_responder_thread(_cid uuid, _atendente uuid, _msg text, _anexo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_corr uuid;
  v_uid uuid;
  v_nova RECORD;
BEGIN
  v_uid := auth.uid();
  SELECT correspondente_id INTO v_corr FROM public.clientes WHERE id = _cid;
  IF v_corr IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;
  IF v_corr <> public.correspondente_do_usuario(v_uid) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF NOT (
    public.usuario_participa_chat(v_uid, _cid, _atendente)
    OR public.has_any_role(v_uid, ARRAY['admin'::app_role, 'correspondente'::app_role])
  ) THEN
    RAISE EXCEPTION 'Sem acesso a esta conversa';
  END IF;

  INSERT INTO public.cliente_app_mensagens (cliente_id, correspondente_id, atendente_id, remetente_tipo, remetente_id, mensagem, anexo_url)
  VALUES (_cid, v_corr, _atendente, 'time', v_uid, _msg, _anexo)
  RETURNING id, remetente_tipo, mensagem, anexo_url, lida_em, criada_em INTO v_nova;

  PERFORM public.notificar_cliente_portal(_cid, v_corr, 'mensagem.time', 'Nova mensagem da sua equipe',
    'Você recebeu uma nova mensagem no App do Cliente.', '/cliente');

  RETURN jsonb_build_object(
    'id', v_nova.id, 'remetente_tipo', v_nova.remetente_tipo, 'mensagem', v_nova.mensagem,
    'anexo_url', v_nova.anexo_url, 'lida_em', v_nova.lida_em, 'criada_em', v_nova.criada_em
  );
END;
$$;