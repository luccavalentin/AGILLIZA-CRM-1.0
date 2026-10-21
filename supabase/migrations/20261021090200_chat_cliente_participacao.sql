-- Chat do cliente (CRM): participação conferida no banco.
--
-- 1) portal_time_nota_interna gravava nota em qualquer conversa do correspondente,
--    bastando informar o atendente. Agora exige o mesmo que portal_time_responder_thread:
--    ser o dono da conversa, participante convidado ou gestor (admin/correspondente).
-- 2) crm_chat_participantes aceitava inserir/remover qualquer pessoa em qualquer conversa
--    (e incluir usuário de outra empresa). Agora só quem participa da conversa, gestor ou
--    quem tem crm.chat › gerir, e a pessoa incluída tem de ser do mesmo correspondente.
-- 3) Índice para "conversas em que participo" (filtro por usuario_id).

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

  IF NOT (
    public.usuario_participa_chat(v_resp, _cid, v_at)
    OR public.has_any_role(v_resp, ARRAY['admin'::app_role, 'correspondente'::app_role])
  ) THEN
    RAISE EXCEPTION 'Sem acesso a esta conversa';
  END IF;

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

-- Quem pode mexer nos participantes de uma conversa.
CREATE OR REPLACE FUNCTION public.pode_gerir_participantes_chat(_uid uuid, _cliente_id uuid, _atendente_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.usuario_participa_chat(_uid, _cliente_id, _atendente_id)
      OR public.has_any_role(_uid, ARRAY['admin'::app_role, 'correspondente'::app_role])
      OR public.usuario_tem_permissao(_uid, 'crm.chat', 'gerir');
$$;

GRANT EXECUTE ON FUNCTION public.pode_gerir_participantes_chat(uuid, uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Equipe gerencia participantes do chat (insert)" ON public.crm_chat_participantes;
CREATE POLICY "Equipe gerencia participantes do chat (insert)"
  ON public.crm_chat_participantes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = crm_chat_participantes.cliente_id
        AND c.correspondente_id = public.correspondente_do_usuario(( SELECT auth.uid() ))
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = crm_chat_participantes.usuario_id
        AND p.correspondente_id = public.correspondente_do_usuario(( SELECT auth.uid() ))
    )
    AND public.pode_gerir_participantes_chat(
      ( SELECT auth.uid() ), crm_chat_participantes.cliente_id, crm_chat_participantes.atendente_id
    )
  );

DROP POLICY IF EXISTS "Equipe gerencia participantes do chat (delete)" ON public.crm_chat_participantes;
CREATE POLICY "Equipe gerencia participantes do chat (delete)"
  ON public.crm_chat_participantes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = crm_chat_participantes.cliente_id
        AND c.correspondente_id = public.correspondente_do_usuario(( SELECT auth.uid() ))
    )
    AND public.pode_gerir_participantes_chat(
      ( SELECT auth.uid() ), crm_chat_participantes.cliente_id, crm_chat_participantes.atendente_id
    )
  );

CREATE INDEX IF NOT EXISTS idx_crm_chat_participantes_usuario
  ON public.crm_chat_participantes (usuario_id);
