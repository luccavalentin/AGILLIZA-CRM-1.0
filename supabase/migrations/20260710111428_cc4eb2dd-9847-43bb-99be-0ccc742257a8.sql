
-- Trigger A: etapa da esteira -> data de contrato do cliente
CREATE OR REPLACE FUNCTION public.sincronizar_data_contrato_por_etapa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_codigo text;
BEGIN
  SELECT ps.codigo INTO v_codigo
  FROM public.pipeline_stages ps
  WHERE ps.id = NEW.stage_id;

  IF v_codigo = 'contrato_emitido' THEN
    UPDATE public.clientes
      SET contrato_emitido_em = CURRENT_DATE
      WHERE id = NEW.cliente_id
        AND contrato_emitido_em IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sincronizar_data_contrato_por_etapa ON public.cliente_pipeline;
CREATE TRIGGER trg_sincronizar_data_contrato_por_etapa
AFTER INSERT OR UPDATE OF stage_id ON public.cliente_pipeline
FOR EACH ROW EXECUTE FUNCTION public.sincronizar_data_contrato_por_etapa();

-- Trigger B: data de contrato do cliente -> etapa da esteira
CREATE OR REPLACE FUNCTION public.sincronizar_etapa_por_data_contrato()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.contrato_emitido_em IS NOT NULL
     AND NEW.contrato_emitido_em IS DISTINCT FROM OLD.contrato_emitido_em THEN
    PERFORM public.cliente_pipeline_avancar_para(
      NEW.id,
      'contrato_emitido',
      'contrato',
      'Contrato emitido em ' || to_char(NEW.contrato_emitido_em, 'DD/MM/YYYY')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sincronizar_etapa_por_data_contrato ON public.clientes;
CREATE TRIGGER trg_sincronizar_etapa_por_data_contrato
AFTER UPDATE OF contrato_emitido_em ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.sincronizar_etapa_por_data_contrato();

-- Backfill: clientes já na etapa "Contrato Emitido" sem data registrada
UPDATE public.clientes c
SET contrato_emitido_em = CURRENT_DATE
FROM public.cliente_pipeline cp
JOIN public.pipeline_stages ps ON ps.id = cp.stage_id
WHERE cp.cliente_id = c.id
  AND ps.codigo = 'contrato_emitido'
  AND c.contrato_emitido_em IS NULL;
