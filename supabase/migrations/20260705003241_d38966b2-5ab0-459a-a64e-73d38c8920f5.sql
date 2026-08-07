CREATE OR REPLACE FUNCTION public.notificar_cliente_portal(
  _cliente_id uuid,
  _corr uuid,
  _tipo text,
  _titulo text,
  _corpo text,
  _link text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _cliente_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.cliente_app_notificacoes (cliente_id, correspondente_id, tipo, titulo, corpo, link)
  VALUES (_cliente_id, _corr, _tipo, _titulo, _corpo, _link);
END;
$$;

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
BEGIN
  IF NEW.cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_ator := COALESCE(NEW.usuario_responsavel_id, NEW.usuario_criador_id);

  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
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
  END IF;

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
BEGIN
  IF NEW.cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_ator := COALESCE(NEW.usuario_responsavel_id, NEW.usuario_criador_id);

  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
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
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_simulacao_before_write ON public.simulacoes;
CREATE TRIGGER trg_simulacao_before_write
BEFORE INSERT OR UPDATE ON public.simulacoes
FOR EACH ROW EXECUTE FUNCTION public.simulacao_before_write();

DROP TRIGGER IF EXISTS trg_simulacao_sincronizar_esteira ON public.simulacoes;
CREATE TRIGGER trg_simulacao_sincronizar_esteira
AFTER INSERT OR UPDATE OF status ON public.simulacoes
FOR EACH ROW EXECUTE FUNCTION public.simulacao_sincronizar_esteira();

DROP TRIGGER IF EXISTS trg_proposta_before_write ON public.propostas;
CREATE TRIGGER trg_proposta_before_write
BEFORE INSERT OR UPDATE ON public.propostas
FOR EACH ROW EXECUTE FUNCTION public.proposta_before_write();

DROP TRIGGER IF EXISTS trg_proposta_sincronizar_esteira ON public.propostas;
CREATE TRIGGER trg_proposta_sincronizar_esteira
AFTER INSERT OR UPDATE OF status ON public.propostas
FOR EACH ROW EXECUTE FUNCTION public.proposta_sincronizar_esteira();

DROP TRIGGER IF EXISTS trg_proposta_contrato_emitido ON public.propostas;
CREATE TRIGGER trg_proposta_contrato_emitido
AFTER UPDATE OF status ON public.propostas
FOR EACH ROW EXECUTE FUNCTION public.on_proposta_contrato_emitido();

DROP TRIGGER IF EXISTS trg_crm_seed_cliente_pipeline ON public.clientes;
CREATE TRIGGER trg_crm_seed_cliente_pipeline
AFTER INSERT ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.crm_seed_cliente_pipeline();

DROP TRIGGER IF EXISTS trg_crm_normalize_documento ON public.clientes;
CREATE TRIGGER trg_crm_normalize_documento
BEFORE INSERT OR UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.crm_normalize_documento();

DROP TRIGGER IF EXISTS trg_cliente_endereco_sincronizar_esteira ON public.cliente_enderecos;
CREATE TRIGGER trg_cliente_endereco_sincronizar_esteira
AFTER INSERT OR UPDATE OF cep ON public.cliente_enderecos
FOR EACH ROW EXECUTE FUNCTION public.cliente_endereco_sincronizar_esteira();

DROP TRIGGER IF EXISTS trg_demanda_before_write ON public.demandas;
CREATE TRIGGER trg_demanda_before_write
BEFORE INSERT OR UPDATE ON public.demandas
FOR EACH ROW EXECUTE FUNCTION public.demanda_before_write();

DROP TRIGGER IF EXISTS trg_demanda_after_insert ON public.demandas;
CREATE TRIGGER trg_demanda_after_insert
AFTER INSERT ON public.demandas
FOR EACH ROW EXECUTE FUNCTION public.demanda_after_insert();

DROP TRIGGER IF EXISTS trg_task_before_write ON public.tasks;
CREATE TRIGGER trg_task_before_write
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.task_before_write();

DROP TRIGGER IF EXISTS trg_financial_receivable_before_write ON public.financial_receivables;
CREATE TRIGGER trg_financial_receivable_before_write
BEFORE INSERT OR UPDATE ON public.financial_receivables
FOR EACH ROW EXECUTE FUNCTION public.financial_receivable_before_write();

DROP TRIGGER IF EXISTS trg_financial_payable_before_write ON public.financial_payables;
CREATE TRIGGER trg_financial_payable_before_write
BEFORE INSERT OR UPDATE ON public.financial_payables
FOR EACH ROW EXECUTE FUNCTION public.financial_payable_before_write();