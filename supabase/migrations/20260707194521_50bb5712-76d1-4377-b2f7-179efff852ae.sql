CREATE OR REPLACE FUNCTION public.demanda_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_horas numeric;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.numero IS NULL OR NEW.numero='' THEN
      NEW.numero := 'DEM-' || lpad(nextval('public.demanda_numero_seq')::text, 6, '0');
    END IF;
    IF NEW.sla_inicio IS NULL THEN NEW.sla_inicio := now(); END IF;
    IF NEW.sla_horas IS NULL THEN
      SELECT horas_uteis INTO v_horas FROM public.sla_configuracoes
        WHERE correspondente_id=NEW.correspondente_id AND tipo=NEW.tipo AND prioridade=NEW.prioridade::text AND ativo LIMIT 1;
      NEW.sla_horas := COALESCE(v_horas, CASE NEW.prioridade WHEN 'p1' THEN 4 WHEN 'p2' THEN 8 ELSE 24 END);
    END IF;
    IF NEW.prazo_sla IS NULL THEN
      NEW.prazo_sla := public.add_horas_uteis(NEW.correspondente_id, NEW.sla_inicio, NEW.sla_horas);
    END IF;
  END IF;
  IF NEW.status='concluida' AND NEW.concluida_em IS NULL THEN NEW.concluida_em := now(); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;