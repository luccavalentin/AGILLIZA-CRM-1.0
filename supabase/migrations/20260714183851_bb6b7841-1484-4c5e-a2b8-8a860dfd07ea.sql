CREATE OR REPLACE FUNCTION public.portal_acompanhamento(_cid uuid)
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
  v_resumo jsonb;
  v_historico jsonb;
  v_evolucao jsonb;
  v_docs_pendentes int;
  v_prazo_prox date;
  v_vist_agenda date;
  v_vist_ok date;
  v_resp uuid;
  v_inicio_janela date;
BEGIN
  SELECT count(*) INTO v_total FROM public.pipeline_stages;
  v_inicio_janela := CURRENT_DATE - INTERVAL '6 days';

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

  SELECT vistoria_agendada_em, vistoria_concluida_em, responsavel_id
  INTO v_vist_agenda, v_vist_ok, v_resp
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

  SELECT jsonb_build_object(
    'proposta_id', pr.id,
    'numero_proposta', pr.numero_proposta,
    'banco', pr.nome_banco,
    'produto', pr.produto,
    'valor_imovel', pr.valor_imovel,
    'valor_solicitado', pr.valor_financiamento,
    'prazo', pr.prazo,
    'responsavel_nome', pf.nome,
    'responsavel_foto', pf.foto_url
  )
  INTO v_resumo
  FROM public.propostas pr
  LEFT JOIN public.profiles pf ON pf.id = COALESCE(pr.usuario_responsavel_id, v_resp)
  WHERE pr.cliente_id = _cid
  ORDER BY pr.created_at DESC
  LIMIT 1;

  IF v_resumo IS NULL THEN
    SELECT jsonb_build_object(
      'proposta_id', NULL,
      'numero_proposta', NULL, 'banco', NULL, 'produto', NULL,
      'valor_imovel', NULL, 'valor_solicitado', NULL, 'prazo', NULL,
      'responsavel_nome', pf.nome, 'responsavel_foto', pf.foto_url
    )
    INTO v_resumo
    FROM public.profiles pf WHERE pf.id = v_resp;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id', h.id, 'tipo', h.tipo, 'descricao', h.descricao, 'created_at', h.created_at
  ) ORDER BY h.created_at DESC)
  INTO v_historico
  FROM (
    SELECT id, tipo, descricao, created_at FROM public.cliente_historico
    WHERE cliente_id = _cid ORDER BY created_at DESC LIMIT 6
  ) h;

  -- Evolução: o primeiro ponto da janela é sempre 0%.
  -- Depois dele, a curva acumula a última etapa movimentada dentro da janela,
  -- sem herdar 100% ou qualquer percentual anterior ao período exibido.
  SELECT jsonb_agg(jsonb_build_object(
    'dia', d.dia,
    'percentual', CASE
      WHEN d.idx = 0 THEN 0
      ELSE LEAST(100, GREATEST(0, ROUND(
        COALESCE((
          SELECT ps.ordem::numeric
          FROM public.cliente_pipeline_historico h
          JOIN public.pipeline_stages ps ON ps.id = h.stage_id
          WHERE h.cliente_id = _cid
            AND h.created_at >= v_inicio_janela
            AND h.created_at < (d.dia + INTERVAL '1 day')
          ORDER BY h.created_at DESC
          LIMIT 1
        ), 0) / NULLIF(v_total, 0) * 100
      )))
    END
  ) ORDER BY d.dia)
  INTO v_evolucao
  FROM (
    SELECT offs AS idx, (v_inicio_janela + (offs || ' days')::interval)::date AS dia
    FROM generate_series(0, 6) AS offs
  ) d;

  SELECT count(*) INTO v_docs_pendentes
  FROM public.cliente_documentos WHERE cliente_id = _cid AND status IN ('pendente','reprovado');

  SELECT (COALESCE(v_ultima::date, CURRENT_DATE) + INTERVAL '7 days')::date INTO v_prazo_prox;

  RETURN jsonb_build_object(
    'processo', jsonb_build_object(
      'etapa_atual', v_stage_nome,
      'descricao', v_stage_desc,
      'ordem_atual', v_ordem_atual,
      'total', v_total,
      'ultima_atualizacao', v_ultima
    ),
    'etapas', COALESCE(v_etapas, '[]'::jsonb),
    'resumo', v_resumo,
    'historico', COALESCE(v_historico, '[]'::jsonb),
    'evolucao', COALESCE(v_evolucao, '[]'::jsonb),
    'documentos_pendentes', v_docs_pendentes,
    'prazo_proxima_etapa', v_prazo_prox
  );
END;
$function$;