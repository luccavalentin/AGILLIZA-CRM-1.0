-- Corrige a sincronização da esteira: crédito recusado NÃO pode avançar para "Crédito aprovado".
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
    -- Recusa de crédito é tratada à parte: mantém/retorna a esteira à etapa de envio,
    -- pois não existe etapa de "recusado" no funil (forward-only avancar_para não moveria de volta).
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
      WHEN 'checklist_documentacao' THEN 'checklist'
      WHEN 'cadastro_complementar'  THEN 'cadastro_complementar'
      WHEN 'dossie_completo'        THEN 'dossie'
      WHEN 'formularios'            THEN 'formularios'
      WHEN 'envio_documentos_banco' THEN 'envio_docs'
      WHEN 'vistoria_agendamento'   THEN 'vistoria_agenda'
      WHEN 'vistoria_concluida'     THEN 'vistoria_ok'
      WHEN 'emissao_contrato'       THEN 'emissao_contrato'
      WHEN 'contrato_emitido'       THEN 'contrato_emitido'
      WHEN 'aguardando_documentos'  THEN 'checklist'
      WHEN 'engenharia_vistoria'    THEN 'vistoria_agenda'
      WHEN 'analise_juridica'       THEN 'emissao_contrato'
      WHEN 'registrado'             THEN 'contrato_emitido'
      ELSE NULL
    END;
    IF v_codigo IS NOT NULL THEN
      PERFORM public.cliente_pipeline_avancar_para(NEW.cliente_id, v_codigo, 'proposta');
    END IF;
  END IF;
  RETURN NEW;
END;$function$;

-- Corrige dados existentes: clientes atualmente em "Crédito aprovado" cuja proposta mais recente
-- foi recusada e que NÃO possuem nenhuma proposta aprovada/adiante — volta para "Enviado p/ aprovação".
WITH alvo AS (
  SELECT cp.cliente_id
  FROM public.cliente_pipeline cp
  JOIN public.pipeline_stages ps ON ps.id = cp.stage_id
  WHERE ps.codigo = 'credito_aprovado'
    AND EXISTS (
      SELECT 1 FROM public.propostas p
      WHERE p.cliente_id = cp.cliente_id AND p.status = 'credito_recusado'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.propostas p
      WHERE p.cliente_id = cp.cliente_id
        AND p.status NOT IN ('credito_recusado','rascunho','erro_envio','cancelada','enviada_banco','em_analise_credito')
    )
)
UPDATE public.cliente_pipeline cp
SET stage_id = (SELECT id FROM public.pipeline_stages WHERE codigo = 'credito_enviado'),
    ultima_atualizacao_em = now()
FROM alvo
WHERE cp.cliente_id = alvo.cliente_id;