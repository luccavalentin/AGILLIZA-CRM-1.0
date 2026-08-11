
CREATE OR REPLACE FUNCTION public.portal_minhas_propostas(_cid uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'banco', nome_banco, 'produto', produto, 'valor', valor_financiamento,
    'status', status, 'enviada_em', enviada_em
  ) ORDER BY created_at DESC), '[]'::jsonb)
  FROM public.propostas
  WHERE cliente_id = _cid
    AND status IN (
      'credito_aprovado','checklist_documentacao','cadastro_complementar',
      'dossie_completo','formularios','envio_documentos_banco','vistoria_agendamento',
      'vistoria_concluida','emissao_contrato','contrato_emitido',
      'aguardando_documentos','engenharia_vistoria','analise_juridica','registrado'
    );
$function$;

CREATE OR REPLACE FUNCTION public.portal_visao_geral(_cid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  SELECT jsonb_agg(jsonb_build_object(
    'ordem', s.ordem,
    'nome', s.nome,
    'descricao_cliente', s.mensagem_cliente,
    'status', CASE WHEN s.ordem < v_ordem_atual THEN 'concluida' WHEN s.ordem = v_ordem_atual THEN 'atual' ELSE 'proxima' END,
    'concluida_em', CASE WHEN s.ordem < v_ordem_atual THEN (
      SELECT min(h.created_at) FROM public.cliente_pipeline_historico h WHERE h.cliente_id = _cid AND h.stage_id = s.id
    ) ELSE NULL END
  ) ORDER BY s.ordem)
  INTO v_etapas
  FROM public.pipeline_stages s;

  SELECT responsavel_id INTO v_resp FROM public.clientes WHERE id = _cid;
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
    'etapas', COALESCE(v_etapas, '[]'::jsonb),
    'contato', v_contato,
    'propostas', COALESCE(v_props, '[]'::jsonb),
    'documentos_pendentes', COALESCE(v_docs, '[]'::jsonb),
    'mensagens_nao_lidas', v_msgs,
    'notificacoes_nao_lidas', v_notif
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_excluir_app_cliente(_cid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = _cid) THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  DELETE FROM public.cliente_app_mensagens WHERE cliente_id = _cid;
  DELETE FROM public.cliente_app_notificacoes WHERE cliente_id = _cid;
  DELETE FROM public.cliente_app_acessos WHERE cliente_id = _cid;

  UPDATE public.clientes SET portal_acesso_ativo = false WHERE id = _cid;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.portal_excluir_app_cliente(uuid) TO anon, authenticated;

CREATE POLICY "cli_docs_insert_anon" ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'cliente-documentos');

CREATE POLICY "cli_docs_select_anon" ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'cliente-documentos');
