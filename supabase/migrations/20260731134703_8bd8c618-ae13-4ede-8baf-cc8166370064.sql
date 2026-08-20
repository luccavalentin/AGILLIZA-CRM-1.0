
CREATE OR REPLACE FUNCTION public.sincronizar_comissoes_usuario_regra(_regra uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD; c RECORD;
  v_base numeric; v_valor numeric; v_rep numeric; v_atualizados int := 0;
BEGIN
  SELECT * INTO r FROM public.comissao_regras_usuario WHERE id = _regra;
  IF NOT FOUND THEN RETURN 0; END IF;

  FOR c IN
    SELECT * FROM public.comissoes_usuario
    WHERE regra_id = _regra AND status = 'a_pagar'
  LOOP
    v_base := NULL;
    IF c.proposta_id IS NOT NULL THEN
      SELECT COALESCE(p.valor_financiamento, 0) INTO v_base
      FROM public.propostas p WHERE p.id = c.proposta_id AND p.deleted_at IS NULL;
      IF r.base_calculo = 'percentual_repasse' THEN
        SELECT COALESCE(valor_bruto, 0) INTO v_rep
        FROM public.comissoes WHERE proposta_id = c.proposta_id LIMIT 1;
        v_base := COALESCE(NULLIF(v_rep, 0), v_base);
      END IF;
    ELSIF c.simulacao_id IS NOT NULL THEN
      SELECT COALESCE(NULLIF(s.valor_financiamento, 0), s.valor_imovel, 0) INTO v_base
      FROM public.simulacoes s WHERE s.id = c.simulacao_id AND s.deleted_at IS NULL;
    END IF;

    v_base := COALESCE(NULLIF(v_base, 0), c.valor_base, 0);
    v_valor := round(v_base * r.percentual / 100.0, 2);

    UPDATE public.comissoes_usuario
       SET percentual = r.percentual,
           base_calculo = r.base_calculo,
           tipo_vinculo = r.tipo_vinculo,
           valor_base = v_base,
           valor_comissao = v_valor
     WHERE id = c.id;

    IF c.payable_id IS NOT NULL THEN
      UPDATE public.financial_payables
         SET valor = v_valor
       WHERE id = c.payable_id AND status <> 'paga';
    END IF;

    v_atualizados := v_atualizados + 1;
  END LOOP;

  RETURN v_atualizados;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalcular_comissoes_usuario_correspondente(_corr uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p RECORD; s RECORD; g RECORD; total int := 0;
BEGIN
  IF NOT public.usuario_pode_financeiro(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _corr IS DISTINCT FROM public.correspondente_do_usuario(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  -- 1) sincroniza lançamentos existentes com o percentual/base atual das regras
  FOR g IN SELECT id FROM public.comissao_regras_usuario WHERE correspondente_id = _corr LOOP
    PERFORM public.sincronizar_comissoes_usuario_regra(g.id);
  END LOOP;

  -- 2) cancela/limpa lançamentos de regras desativadas
  UPDATE public.financial_payables fp
     SET status = 'cancelada'
    FROM public.comissoes_usuario cu
    JOIN public.comissao_regras_usuario cr ON cr.id = cu.regra_id
   WHERE cu.payable_id = fp.id
     AND cu.correspondente_id = _corr
     AND cu.status = 'a_pagar'
     AND cr.ativo = false
     AND fp.status <> 'paga';

  UPDATE public.comissoes_usuario cu
     SET status = 'cancelada'
    FROM public.comissao_regras_usuario cr
   WHERE cr.id = cu.regra_id
     AND cu.correspondente_id = _corr
     AND cu.status = 'a_pagar'
     AND cr.ativo = false;

  -- 3) gera novos lançamentos
  FOR s IN SELECT id FROM public.simulacoes WHERE correspondente_id = _corr AND deleted_at IS NULL LOOP
    total := total + public.calcular_comissoes_usuario_simulacao(s.id);
  END LOOP;

  FOR p IN SELECT id, status FROM public.propostas WHERE correspondente_id = _corr AND deleted_at IS NULL LOOP
    total := total + public.calcular_comissoes_usuario_proposta(p.id, p.status::text);
  END LOOP;

  RETURN total;
END;
$$;

CREATE OR REPLACE FUNCTION public.excluir_regra_comissao_usuario(_regra uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_corr uuid; v_removidos int := 0;
BEGIN
  IF NOT public.usuario_pode_financeiro(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT correspondente_id INTO v_corr FROM public.comissao_regras_usuario WHERE id = _regra;
  IF v_corr IS NULL THEN RETURN 0; END IF;
  IF v_corr IS DISTINCT FROM public.correspondente_do_usuario(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  DELETE FROM public.financial_payables fp
   USING public.comissoes_usuario cu
   WHERE cu.regra_id = _regra
     AND cu.payable_id = fp.id;

  WITH del AS (DELETE FROM public.comissoes_usuario WHERE regra_id = _regra RETURNING 1)
  SELECT count(*) INTO v_removidos FROM del;

  DELETE FROM public.comissao_regras_usuario WHERE id = _regra;

  RETURN v_removidos;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sincronizar_comissoes_usuario_regra(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_regra_comissao_usuario(uuid) TO authenticated;
