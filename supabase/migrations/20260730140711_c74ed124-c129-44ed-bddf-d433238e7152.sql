-- evita duplicidade de lançamento por regra/proposta/usuário
CREATE UNIQUE INDEX IF NOT EXISTS uq_comissoes_usuario_regra
  ON public.comissoes_usuario (proposta_id, usuario_id, regra_id)
  WHERE regra_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.on_proposta_comissao_usuario_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.calcular_comissoes_usuario_proposta(NEW.id, NEW.status::text);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_proposta_comissao_usuario_insert ON public.propostas;
CREATE TRIGGER trg_proposta_comissao_usuario_insert
AFTER INSERT ON public.propostas
FOR EACH ROW EXECUTE FUNCTION public.on_proposta_comissao_usuario_insert();

-- recalcula comissões de usuário das propostas existentes (usa o status atual como gatilho)
CREATE OR REPLACE FUNCTION public.recalcular_comissoes_usuario_correspondente(_corr uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD;
  total int := 0;
BEGIN
  IF NOT public.usuario_pode_financeiro(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF _corr IS DISTINCT FROM public.correspondente_do_usuario(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  FOR p IN SELECT id, status FROM public.propostas WHERE correspondente_id = _corr LOOP
    total := total + public.calcular_comissoes_usuario_proposta(p.id, p.status::text);
  END LOOP;
  RETURN total;
END;
$function$;

REVOKE ALL ON FUNCTION public.recalcular_comissoes_usuario_correspondente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalcular_comissoes_usuario_correspondente(uuid) TO authenticated;