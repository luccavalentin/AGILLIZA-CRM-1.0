-- Campos de acompanhamento da proposta: quando o status mudou pela última vez
-- e quando houve a última sincronização (leitura) com o banco.
ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS status_atualizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultima_sincronizacao_em timestamptz;

-- Backfill: usa a última atualização/criação como ponto de partida.
UPDATE public.propostas
SET status_atualizado_em = COALESCE(status_atualizado_em, updated_at, created_at)
WHERE status_atualizado_em IS NULL;

-- Estende o trigger existente para marcar automaticamente status_atualizado_em
-- sempre que o status da proposta mudar (por sync, kanban ou ficha).
CREATE OR REPLACE FUNCTION public.proposta_before_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP='INSERT' THEN
    IF (NEW.numero_proposta IS NULL OR NEW.numero_proposta='') THEN
      NEW.numero_proposta := 'PRO-' || lpad(nextval('public.proposta_numero_seq')::text, 6, '0');
    END IF;
    NEW.status_atualizado_em := COALESCE(NEW.status_atualizado_em, now());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_atualizado_em := now();
  END IF;
  IF NEW.cpf_cnpj IS NOT NULL THEN NEW.cpf_cnpj := regexp_replace(NEW.cpf_cnpj,'\D','','g'); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;$function$;