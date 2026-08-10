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
    WHEN NEW.status = 'promovida' THEN 'aprovacao'
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

  v_stage := CASE
    WHEN NEW.status IN ('enviada_banco','em_analise_credito') THEN 'aprovacao'
    WHEN NEW.status = 'credito_aprovado' THEN 'documentacao_completa'
    WHEN NEW.status = 'aguardando_documentos' THEN 'banco_remessa_2'
    WHEN NEW.status = 'engenharia_vistoria' THEN 'vistoria_agendada'
    WHEN NEW.status = 'analise_juridica' THEN 'analise_juridica'
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

CREATE OR REPLACE FUNCTION public.on_proposta_contrato_emitido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'contrato_emitido'
     AND (
       OLD.status IS DISTINCT FROM NEW.status
       OR NOT EXISTS (SELECT 1 FROM public.comissoes c WHERE c.proposta_id = NEW.id)
     ) THEN
    PERFORM public.calcular_comissao_proposta(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.simulacao_sincronizar_esteira() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.proposta_sincronizar_esteira() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_proposta_contrato_emitido() FROM PUBLIC, anon, authenticated;