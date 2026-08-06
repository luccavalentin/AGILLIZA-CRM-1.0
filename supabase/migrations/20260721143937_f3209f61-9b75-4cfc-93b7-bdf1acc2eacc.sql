CREATE OR REPLACE FUNCTION public.rh_funcionario_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.rh_semear_checklist_clt(NEW.id);
  INSERT INTO public.rh_ferias (correspondente_id, funcionario_id, periodo_aquisitivo_inicio, periodo_aquisitivo_fim, status)
  VALUES (NEW.correspondente_id, NEW.id, NEW.data_admissao, NEW.data_admissao + INTERVAL '1 year' - INTERVAL '1 day', 'planejada')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;