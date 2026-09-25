-- Etapa de formulários do banco na esteira do CRM.
--
-- `formularios` deixou de ser status legado: é a etapa que Itaú ("Formulários
-- Digitais") e Santander ("Cadastro das Informações") têm entre o crédito e os
-- documentos. Na esteira do cliente ela continua em "Crédito aprovado" — os
-- documentos ainda não começaram — em vez de adiantar o cliente para "Coleta
-- de documentos", e o aviso diz o que está acontecendo.
--
-- Só essas duas linhas mudam; o resto da função é o mesmo em produção em
-- 25/09/2026 (lido com pg_get_functiondef antes desta migração).

CREATE OR REPLACE FUNCTION public.proposta_sincronizar_esteira()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    WHEN NEW.status IN ('enviada_banco','em_analise_credito') THEN 'credito_enviado'
    WHEN NEW.status IN ('credito_aprovado','credito_condicionado','formularios') THEN 'credito_aprovado'
    WHEN NEW.status IN ('aguardando_documentos','checklist_documentacao','cadastro_complementar','dossie_completo','envio_documentos_banco') THEN 'coleta_documentos'
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
    WHEN NEW.status = 'credito_condicionado' THEN 'Crédito aprovado com condições'
    WHEN NEW.status = 'credito_recusado' THEN 'Crédito não aprovado'
    WHEN NEW.status = 'formularios' THEN 'Formulários do banco'
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
$function$;
