
-- 1) Cria as 3 macro-etapas alinhadas ao kanban de propostas (ordem temporária alta)
INSERT INTO public.pipeline_stages (codigo, nome, ordem, mensagem_cliente) VALUES
  ('coleta_documentos', 'Coleta de documentos', 106, 'Estamos reunindo e organizando a documentação necessária.'),
  ('engenharia_vistoria', 'Engenharia / vistoria', 107, 'Vistoria de engenharia do imóvel em andamento.'),
  ('analise_juridica', 'Análise jurídica', 108, 'Documentação em análise jurídica para emissão do contrato.')
ON CONFLICT (codigo) DO NOTHING;

-- 2) Remapeia clientes das etapas granulares antigas para as macro-etapas
UPDATE public.cliente_pipeline cp
SET stage_id = (SELECT id FROM public.pipeline_stages WHERE codigo = 'coleta_documentos')
WHERE cp.stage_id IN (SELECT id FROM public.pipeline_stages WHERE codigo IN ('checklist','cadastro_complementar','dossie','formularios','envio_docs'));

UPDATE public.cliente_pipeline cp
SET stage_id = (SELECT id FROM public.pipeline_stages WHERE codigo = 'engenharia_vistoria')
WHERE cp.stage_id IN (SELECT id FROM public.pipeline_stages WHERE codigo IN ('vistoria_agenda','vistoria_ok'));

UPDATE public.cliente_pipeline cp
SET stage_id = (SELECT id FROM public.pipeline_stages WHERE codigo = 'analise_juridica')
WHERE cp.stage_id IN (SELECT id FROM public.pipeline_stages WHERE codigo = 'emissao_contrato');

-- Histórico aponta para etapas que serão removidas: remapeia para não quebrar FK
UPDATE public.cliente_pipeline_historico h
SET stage_id = (SELECT id FROM public.pipeline_stages WHERE codigo = 'coleta_documentos')
WHERE h.stage_id IN (SELECT id FROM public.pipeline_stages WHERE codigo IN ('checklist','cadastro_complementar','dossie','formularios','envio_docs'));

UPDATE public.cliente_pipeline_historico h
SET stage_id = (SELECT id FROM public.pipeline_stages WHERE codigo = 'engenharia_vistoria')
WHERE h.stage_id IN (SELECT id FROM public.pipeline_stages WHERE codigo IN ('vistoria_agenda','vistoria_ok'));

UPDATE public.cliente_pipeline_historico h
SET stage_id = (SELECT id FROM public.pipeline_stages WHERE codigo = 'analise_juridica')
WHERE h.stage_id IN (SELECT id FROM public.pipeline_stages WHERE codigo = 'emissao_contrato');

-- 3) Remove as etapas granulares antigas
DELETE FROM public.pipeline_stages
WHERE codigo IN ('checklist','cadastro_complementar','dossie','formularios','envio_docs','vistoria_agenda','vistoria_ok','emissao_contrato');

-- 4) Reordena a esteira final (9 etapas)
UPDATE public.pipeline_stages SET ordem = 1 WHERE codigo = 'cadastro_basico';
UPDATE public.pipeline_stages SET ordem = 2 WHERE codigo = 'cadastro_completo';
UPDATE public.pipeline_stages SET ordem = 3 WHERE codigo = 'simulacao';
UPDATE public.pipeline_stages SET ordem = 4 WHERE codigo = 'credito_enviado';
UPDATE public.pipeline_stages SET ordem = 5 WHERE codigo = 'credito_aprovado';
UPDATE public.pipeline_stages SET ordem = 6 WHERE codigo = 'coleta_documentos';
UPDATE public.pipeline_stages SET ordem = 7 WHERE codigo = 'engenharia_vistoria';
UPDATE public.pipeline_stages SET ordem = 8 WHERE codigo = 'analise_juridica';
UPDATE public.pipeline_stages SET ordem = 9 WHERE codigo = 'contrato_emitido';

-- 5) Atualiza o gatilho da proposta para usar as macro-etapas do kanban
CREATE OR REPLACE FUNCTION public.proposta_sincronizar_esteira()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_codigo TEXT;
BEGIN
  IF NEW.cliente_id IS NULL THEN RETURN NEW; END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'credito_recusado' THEN
      PERFORM public.cliente_pipeline_definir(
        NEW.cliente_id,
        'credito_enviado',
        'Crédito recusado pelo banco na proposta ' || COALESCE(NEW.numero_proposta, NEW.id::text)
      );
      RETURN NEW;
    END IF;

    v_codigo := CASE NEW.status
      WHEN 'rascunho'               THEN 'simulacao'
      WHEN 'erro_envio'             THEN 'simulacao'
      WHEN 'enviada_banco'          THEN 'credito_enviado'
      WHEN 'em_analise_credito'     THEN 'credito_enviado'
      WHEN 'credito_aprovado'       THEN 'credito_aprovado'
      WHEN 'aguardando_documentos'  THEN 'coleta_documentos'
      WHEN 'engenharia_vistoria'    THEN 'engenharia_vistoria'
      WHEN 'analise_juridica'       THEN 'analise_juridica'
      WHEN 'contrato_emitido'       THEN 'contrato_emitido'
      -- Legados granulares -> macro-etapas
      WHEN 'checklist_documentacao' THEN 'coleta_documentos'
      WHEN 'cadastro_complementar'  THEN 'coleta_documentos'
      WHEN 'dossie_completo'        THEN 'coleta_documentos'
      WHEN 'formularios'            THEN 'coleta_documentos'
      WHEN 'envio_documentos_banco' THEN 'coleta_documentos'
      WHEN 'vistoria_agendamento'   THEN 'engenharia_vistoria'
      WHEN 'vistoria_concluida'     THEN 'engenharia_vistoria'
      WHEN 'emissao_contrato'       THEN 'analise_juridica'
      WHEN 'registrado'             THEN 'contrato_emitido'
      ELSE NULL
    END;
    IF v_codigo IS NOT NULL THEN
      PERFORM public.cliente_pipeline_avancar_para(NEW.cliente_id, v_codigo, 'proposta');
    END IF;
  END IF;
  RETURN NEW;
END;$function$;

-- 6) Atualiza o gatilho da simulação: promovida avança até o envio de crédito
CREATE OR REPLACE FUNCTION public.simulacao_sincronizar_esteira()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stage text;
  v_titulo text;
  v_corpo text;
  v_ator uuid;
  v_deve_processar boolean;
BEGIN
  IF NEW.cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_deve_processar := TG_OP = 'INSERT'
    OR OLD.status IS DISTINCT FROM NEW.status
    OR NOT EXISTS (
      SELECT 1
      FROM public.cliente_historico ch
      WHERE ch.cliente_id = NEW.cliente_id
        AND ch.tipo = 'simulacao'
        AND ch.metadata->>'simulacao_id' = NEW.id::text
        AND ch.metadata->>'status' = NEW.status::text
    );

  IF NOT v_deve_processar THEN
    RETURN NEW;
  END IF;

  v_ator := COALESCE(NEW.usuario_responsavel_id, NEW.usuario_criador_id);

  v_stage := CASE
    WHEN NEW.status IN ('simulada','parcialmente_simulada') THEN 'simulacao'
    WHEN NEW.status = 'promovida' THEN 'credito_enviado'
    ELSE NULL
  END;

  IF v_stage IS NOT NULL THEN
    PERFORM public.cliente_pipeline_avancar_para(
      NEW.cliente_id,
      v_stage,
      'simulacao',
      'Simulação ' || COALESCE(NEW.numero_simulacao, NEW.id::text) || ' atualizada para ' || NEW.status::text
    );
  END IF;

  INSERT INTO public.cliente_historico (cliente_id, tipo, descricao, ator_id, metadata)
  VALUES (
    NEW.cliente_id,
    'simulacao',
    'Simulação ' || COALESCE(NEW.numero_simulacao, NEW.id::text) || ' atualizada para ' || NEW.status::text,
    v_ator,
    jsonb_build_object('simulacao_id', NEW.id, 'status', NEW.status::text)
  );

  v_titulo := CASE
    WHEN NEW.status = 'simulada' THEN 'Simulação concluída'
    WHEN NEW.status = 'parcialmente_simulada' THEN 'Simulação parcialmente concluída'
    WHEN NEW.status = 'promovida' THEN 'Simulação enviada para proposta'
    WHEN NEW.status = 'erro_banco' THEN 'Simulação com pendência'
    WHEN NEW.status = 'cancelada' THEN 'Simulação cancelada'
    ELSE 'Simulação atualizada'
  END;

  v_corpo := 'Sua simulação ' || COALESCE(NEW.numero_simulacao, '') || ' foi atualizada.';

  PERFORM public.notificar_cliente_portal(
    NEW.cliente_id,
    NEW.correspondente_id,
    'simulacao.status',
    v_titulo,
    v_corpo,
    '/cliente'
  );

  PERFORM public.emitir_notificacao(
    v_ator,
    NEW.correspondente_id,
    'simulacao.status',
    v_titulo,
    'Cliente ' || COALESCE(NEW.nome_cliente, '') || ': ' || NEW.status::text,
    '/operacional/simulacoes/' || NEW.id
  );

  RETURN NEW;
END;
$function$;

-- 7) Ajusta portal_visao_geral para os novos códigos de vistoria/contrato
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
