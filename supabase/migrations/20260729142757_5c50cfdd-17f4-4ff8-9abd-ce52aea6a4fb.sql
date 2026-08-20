CREATE OR REPLACE FUNCTION public.portal_visao_geral(_cid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ordem_atual int;
  v_total int;
  v_stage_nome text;
  v_stage_desc text;
  v_ultima timestamptz;
  v_etapas jsonb;
  v_contato jsonb;
  v_props jsonb;
  v_docs jsonb;
  v_msgs int;
  v_notif int;
  v_resp uuid;
  v_vist_agenda date;
  v_vist_ok date;
BEGIN
  SELECT count(*) INTO v_total FROM public.pipeline_stages;

  SELECT ps.ordem, ps.nome, ps.mensagem_cliente, cp.ultima_atualizacao_em
  INTO v_ordem_atual, v_stage_nome, v_stage_desc, v_ultima
  FROM public.cliente_pipeline cp
  JOIN public.pipeline_stages ps ON ps.id = cp.stage_id
  WHERE cp.cliente_id = _cid;

  IF v_ordem_atual IS NULL THEN
    SELECT ordem, nome, mensagem_cliente INTO v_ordem_atual, v_stage_nome, v_stage_desc
    FROM public.pipeline_stages ORDER BY ordem LIMIT 1;
    v_ordem_atual := COALESCE(v_ordem_atual, 0);
  END IF;

  SELECT vistoria_agendada_em, vistoria_concluida_em
  INTO v_vist_agenda, v_vist_ok
  FROM public.clientes WHERE id = _cid;

  SELECT jsonb_agg(jsonb_build_object(
    'ordem', s.ordem,
    'nome', s.nome,
    'descricao_cliente', s.mensagem_cliente,
    'status', CASE WHEN s.ordem < v_ordem_atual THEN 'concluida' WHEN s.ordem = v_ordem_atual THEN 'atual' ELSE 'proxima' END,
    'concluida_em', CASE WHEN s.ordem < v_ordem_atual THEN (
      SELECT min(h.created_at) FROM public.cliente_pipeline_historico h WHERE h.cliente_id = _cid AND h.stage_id = s.id
    ) ELSE NULL END,
    'data_marco', CASE
      WHEN s.codigo = 'engenharia_vistoria' THEN to_jsonb(COALESCE(v_vist_ok, v_vist_agenda))
      ELSE NULL END
  ) ORDER BY s.ordem)
  INTO v_etapas
  FROM public.pipeline_stages s;

  SELECT COALESCE(pr.usuario_responsavel_id, pr.usuario_criador_id) INTO v_resp
  FROM public.propostas pr
  WHERE pr.cliente_id = _cid
    AND COALESCE(pr.usuario_responsavel_id, pr.usuario_criador_id) IS NOT NULL
    AND COALESCE(pr.usuario_responsavel_id, pr.usuario_criador_id) <> _cid
  ORDER BY
    CASE WHEN pr.enviada_em IS NOT NULL THEN 0 ELSE 1 END,
    COALESCE(pr.enviada_em, pr.created_at) DESC
  LIMIT 1;

  IF v_resp IS NULL THEN
    SELECT c.responsavel_id INTO v_resp
    FROM public.clientes c
    JOIN public.profiles p ON p.id = c.responsavel_id
    WHERE c.id = _cid
      AND c.responsavel_id IS NOT NULL
      AND c.responsavel_id <> c.id;
  END IF;

  IF v_resp IS NOT NULL THEN
    SELECT jsonb_build_object('nome', p.nome, 'foto_url', p.foto_url) INTO v_contato
    FROM public.profiles p WHERE p.id = v_resp;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id', id, 'banco', nome_banco, 'produto', produto, 'valor', valor_financiamento, 'status', status
  ) ORDER BY created_at DESC)
  INTO v_props FROM public.propostas
  WHERE cliente_id = _cid
    AND status IN (
      'credito_aprovado','checklist_documentacao','cadastro_complementar',
      'dossie_completo','formularios','envio_documentos_banco','vistoria_agendamento',
      'vistoria_concluida','emissao_contrato','contrato_emitido',
      'aguardando_documentos','engenharia_vistoria','analise_juridica','registrado'
    );

  SELECT jsonb_agg(jsonb_build_object(
    'id', id, 'tipo_documento', tipo_documento, 'nome_arquivo', nome_arquivo, 'status', status
  ))
  INTO v_docs FROM public.cliente_documentos WHERE cliente_id = _cid AND status IN ('pendente','reprovado');

  SELECT count(*) INTO v_msgs FROM public.cliente_app_mensagens
    WHERE cliente_id = _cid AND remetente_tipo = 'time' AND lida_em IS NULL;
  SELECT count(*) INTO v_notif FROM public.cliente_app_notificacoes
    WHERE cliente_id = _cid AND lida = false;

  RETURN jsonb_build_object(
    'ordem_atual', v_ordem_atual,
    'total', v_total,
    'etapa_atual', v_stage_nome,
    'descricao', v_stage_desc,
    'ultima_atualizacao', v_ultima,
    'vistoria_agendada_em', to_jsonb(v_vist_agenda),
    'vistoria_concluida_em', to_jsonb(v_vist_ok),
    'etapas', COALESCE(v_etapas, '[]'::jsonb),
    'contato', v_contato,
    'propostas', COALESCE(v_props, '[]'::jsonb),
    'documentos_pendentes', COALESCE(v_docs, '[]'::jsonb),
    'mensagens_nao_lidas', v_msgs,
    'notificacoes_nao_lidas', v_notif
  );
END;
$function$;

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
  analista_proposta AS (
    SELECT COALESCE(pr.usuario_responsavel_id, pr.usuario_criador_id) AS atendente_id
      FROM public.propostas pr
     WHERE pr.cliente_id = _cid
       AND COALESCE(pr.usuario_responsavel_id, pr.usuario_criador_id) IS NOT NULL
       AND COALESCE(pr.usuario_responsavel_id, pr.usuario_criador_id) <> _cid
     ORDER BY CASE WHEN pr.enviada_em IS NOT NULL THEN 0 ELSE 1 END,
              COALESCE(pr.enviada_em, pr.created_at) DESC
     LIMIT 1
  ),
  resp AS (
    SELECT c.responsavel_id AS atendente_id
      FROM public.clientes c
      JOIN public.profiles p ON p.id = c.responsavel_id
     WHERE c.id = _cid
       AND c.responsavel_id IS NOT NULL
       AND c.responsavel_id <> c.id
  ),
  todos AS (
    SELECT atendente_id FROM base
    UNION
    SELECT atendente_id FROM analista_proposta
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
  WHERE t.atendente_id IS NOT NULL
    AND t.atendente_id <> _cid;
$function$;

CREATE OR REPLACE FUNCTION public.crm_transferir_atendimento(
  _cliente_id uuid,
  _novo_responsavel uuid,
  _observacao text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_solicitante uuid := auth.uid();
  v_corr uuid;
  v_atual uuid;
  v_novo_corr uuid;
  v_novo_nome text;
  v_cli_nome text;
BEGIN
  IF v_solicitante IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  SELECT correspondente_id, responsavel_id, nome
    INTO v_corr, v_atual, v_cli_nome
    FROM public.clientes WHERE id = _cliente_id;
  IF v_corr IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado.';
  END IF;

  IF v_corr <> public.correspondente_do_usuario(v_solicitante) THEN
    RAISE EXCEPTION 'Sem permissão para este cliente.';
  END IF;

  IF NOT (
    public.has_any_role(v_solicitante, ARRAY['admin','correspondente','gestor']::public.app_role[])
    OR public.usuario_tem_permissao(v_solicitante, 'crm.clientes', 'update')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para transferir atendimento.';
  END IF;

  SELECT correspondente_id, nome INTO v_novo_corr, v_novo_nome
    FROM public.profiles WHERE id = _novo_responsavel;
  IF v_novo_corr IS NULL OR v_novo_corr <> v_corr THEN
    RAISE EXCEPTION 'Usuário destino inválido.';
  END IF;

  IF v_atual = _novo_responsavel THEN
    RETURN jsonb_build_object('ok', true, 'inalterado', true);
  END IF;

  UPDATE public.clientes
     SET responsavel_id = _novo_responsavel,
         updated_at = now()
   WHERE id = _cliente_id;

  INSERT INTO public.cliente_historico (cliente_id, tipo, descricao, ator_id, metadata)
  VALUES (
    _cliente_id,
    'transferencia',
    'Atendimento transferido para ' || COALESCE(v_novo_nome,'usuário') ||
      CASE WHEN _observacao IS NOT NULL AND length(trim(_observacao))>0
           THEN ' — ' || _observacao ELSE '' END,
    v_solicitante,
    jsonb_build_object('responsavel_anterior', v_atual, 'responsavel_novo', _novo_responsavel)
  );

  PERFORM public.emitir_notificacao(
    _novo_responsavel, v_corr, 'cliente.transferido',
    'Novo atendimento atribuído a você',
    'Você recebeu o atendimento do cliente ' || COALESCE(v_cli_nome, ''),
    '/crm/clientes/' || _cliente_id
  );

  RETURN jsonb_build_object('ok', true, 'responsavel_id', _novo_responsavel);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.crm_transferir_atendimento(uuid, uuid, text) TO authenticated;