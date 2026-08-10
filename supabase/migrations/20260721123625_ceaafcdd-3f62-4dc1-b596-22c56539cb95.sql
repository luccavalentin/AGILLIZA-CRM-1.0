-- Corrige mapeamento dos triggers de sincronização da esteira do CRM.
-- Os códigos antigos ('aprovacao', 'documentacao_completa', 'banco_remessa_2',
-- 'vistoria_agendada') não existem mais em public.pipeline_stages, então o
-- avanço automático dos clientes ficava silenciosamente sem efeito nas etapas
-- 4-6 e 7. Ajustamos para os códigos atuais das etapas.

CREATE OR REPLACE FUNCTION public.simulacao_sincronizar_esteira()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

REVOKE EXECUTE ON FUNCTION public.simulacao_sincronizar_esteira() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.proposta_sincronizar_esteira()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_stage text;
  v_titulo text;
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
        AND ch.tipo = 'proposta'
        AND ch.metadata->>'proposta_id' = NEW.id::text
        AND ch.metadata->>'status' = NEW.status::text
    );

  IF NOT v_deve_processar THEN
    RETURN NEW;
  END IF;

  v_ator := COALESCE(NEW.usuario_responsavel_id, NEW.usuario_criador_id);

  -- Mapeia status da proposta para os códigos ATUAIS de public.pipeline_stages
  -- (etapas 4-9). Os códigos antigos ('aprovacao', 'documentacao_completa',
  -- 'banco_remessa_2', 'vistoria_agendada') foram descontinuados e o
  -- avanço automático ficava sem efeito.
  v_stage := CASE
    WHEN NEW.status IN ('enviada_banco','em_analise_credito') THEN 'credito_enviado'
    WHEN NEW.status = 'credito_aprovado' THEN 'credito_aprovado'
    WHEN NEW.status IN ('aguardando_documentos','checklist_documentacao','cadastro_complementar','dossie_completo','formularios','envio_documentos_banco') THEN 'coleta_documentos'
    WHEN NEW.status IN ('engenharia_vistoria','vistoria_agendamento','vistoria_concluida') THEN 'engenharia_vistoria'
    WHEN NEW.status IN ('analise_juridica','emissao_contrato') THEN 'analise_juridica'
    WHEN NEW.status IN ('contrato_emitido','registrado') THEN 'contrato_emitido'
    ELSE NULL
  END;

  IF v_stage IS NOT NULL THEN
    PERFORM public.cliente_pipeline_avancar_para(
      NEW.cliente_id,
      v_stage,
      'proposta',
      'Proposta ' || COALESCE(NEW.numero_proposta, NEW.id::text) || ' atualizada para ' || NEW.status::text
    );
  END IF;

  INSERT INTO public.cliente_historico (cliente_id, tipo, descricao, ator_id, metadata)
  VALUES (
    NEW.cliente_id,
    'proposta',
    'Proposta ' || COALESCE(NEW.numero_proposta, NEW.id::text) || ' atualizada para ' || NEW.status::text,
    v_ator,
    jsonb_build_object('proposta_id', NEW.id, 'simulacao_id', NEW.simulacao_id, 'status', NEW.status::text)
  );

  v_titulo := CASE
    WHEN NEW.status IN ('enviada_banco','em_analise_credito') THEN 'Proposta em análise'
    WHEN NEW.status = 'credito_aprovado' THEN 'Crédito aprovado'
    WHEN NEW.status = 'credito_recusado' THEN 'Crédito não aprovado'
    WHEN NEW.status = 'aguardando_documentos' THEN 'Documentação pendente'
    WHEN NEW.status = 'engenharia_vistoria' THEN 'Vistoria em andamento'
    WHEN NEW.status = 'analise_juridica' THEN 'Análise jurídica em andamento'
    WHEN NEW.status = 'contrato_emitido' THEN 'Contrato emitido'
    WHEN NEW.status = 'registrado' THEN 'Processo registrado'
    WHEN NEW.status = 'cancelada' THEN 'Proposta cancelada'
    ELSE 'Proposta atualizada'
  END;

  PERFORM public.notificar_cliente_portal(
    NEW.cliente_id,
    NEW.correspondente_id,
    'proposta.status',
    v_titulo,
    'Sua proposta ' || COALESCE(NEW.numero_proposta, '') || ' foi atualizada.',
    '/cliente'
  );

  PERFORM public.emitir_notificacao(
    v_ator,
    NEW.correspondente_id,
    'proposta.status',
    v_titulo,
    'Cliente ' || COALESCE(NEW.nome_cliente, '') || ': ' || NEW.status::text,
    '/operacional/propostas/' || NEW.id
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.proposta_sincronizar_esteira() FROM PUBLIC, anon, authenticated;