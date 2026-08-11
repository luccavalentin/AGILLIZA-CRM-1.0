-- 1) comissoes_usuario passa a aceitar origem em simulação
ALTER TABLE public.comissoes_usuario ALTER COLUMN proposta_id DROP NOT NULL;
ALTER TABLE public.comissoes_usuario ADD COLUMN IF NOT EXISTS simulacao_id uuid REFERENCES public.simulacoes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_comissoes_usuario_simulacao ON public.comissoes_usuario(simulacao_id);

-- 2) helper: usuário participa do registro?
CREATE OR REPLACE FUNCTION public.usuario_participa_registro(_uid uuid, _ids uuid[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT _uid = ANY(_ids)
$$;

-- 3) proposta: exige vínculo do usuário com o registro
CREATE OR REPLACE FUNCTION public.calcular_comissoes_usuario_proposta(_prop_id uuid, _gatilho text DEFAULT 'contrato_emitido'::text)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD; r RECORD;
  v_repasse numeric; v_valor_contrato numeric; v_base numeric; v_valor numeric;
  v_com_id uuid; v_pay_id uuid; v_nome text; v_ids uuid[];
  v_hoje date := CURRENT_DATE; v_criados int := 0;
BEGIN
  SELECT * INTO p FROM public.propostas WHERE id = _prop_id;
  IF NOT FOUND OR p.deleted_at IS NOT NULL THEN RETURN 0; END IF;

  v_ids := ARRAY_REMOVE(ARRAY[p.usuario_criador_id, p.usuario_responsavel_id, p.analista_id, p.comercial_id, p.parceiro_id, p.usuario_parceiro_id], NULL);
  v_valor_contrato := COALESCE(p.valor_financiamento, 0);
  SELECT COALESCE(valor_bruto, 0) INTO v_repasse FROM public.comissoes WHERE proposta_id = _prop_id LIMIT 1;
  v_repasse := COALESCE(v_repasse, 0);

  FOR r IN
    SELECT * FROM public.comissao_regras_usuario cr
    WHERE cr.correspondente_id = p.correspondente_id
      AND cr.ativo = true
      AND cr.gatilho = _gatilho
      AND cr.usuario_id = ANY(v_ids)
      AND (cr.banco_nome IS NULL OR cr.banco_nome = p.nome_banco)
      AND (cr.produto IS NULL OR cr.produto = p.produto)
      AND (cr.vigencia_inicio IS NULL OR cr.vigencia_inicio <= v_hoje)
      AND (cr.vigencia_fim IS NULL OR cr.vigencia_fim >= v_hoje)
  LOOP
    IF EXISTS (SELECT 1 FROM public.comissoes_usuario WHERE proposta_id = _prop_id AND usuario_id = r.usuario_id AND regra_id = r.id) THEN
      CONTINUE;
    END IF;

    IF r.base_calculo = 'valor_contrato' THEN
      v_base := v_valor_contrato;
    ELSE
      v_base := COALESCE(NULLIF(v_repasse, 0), v_valor_contrato);
    END IF;
    IF COALESCE(v_base, 0) <= 0 THEN CONTINUE; END IF;
    v_valor := round(v_base * r.percentual / 100.0, 2);

    SELECT nome INTO v_nome FROM public.profiles WHERE id = r.usuario_id;

    INSERT INTO public.financial_payables (correspondente_id, descricao, parceiro_id, vencimento, valor, status, criador_id)
    VALUES (p.correspondente_id, 'Comissão ' || COALESCE(p.numero_proposta,'') || ' — ' || COALESCE(v_nome,''),
            r.usuario_id, v_hoje + 35, v_valor, 'aberta', p.usuario_responsavel_id)
    RETURNING id INTO v_pay_id;

    INSERT INTO public.comissoes_usuario (
      correspondente_id, proposta_id, usuario_id, regra_id, tipo_vinculo, gatilho, base_calculo,
      percentual, valor_base, valor_comissao, banco_nome, produto, numero_proposta, status, payable_id
    ) VALUES (
      p.correspondente_id, _prop_id, r.usuario_id, r.id, r.tipo_vinculo, r.gatilho, r.base_calculo,
      r.percentual, v_base, v_valor, p.nome_banco, p.produto, p.numero_proposta, 'a_pagar', v_pay_id
    ) RETURNING id INTO v_com_id;

    INSERT INTO public.financial_audit_logs (correspondente_id, entidade, entidade_id, acao, dados)
    VALUES (p.correspondente_id, 'comissao_usuario', v_com_id, 'calculada',
            jsonb_build_object('usuario_id', r.usuario_id, 'valor', v_valor, 'gatilho', _gatilho, 'base', r.base_calculo, 'percentual', r.percentual));

    v_criados := v_criados + 1;
  END LOOP;
  RETURN v_criados;
END;
$function$;

-- 4) simulação: gatilho "Simulação" (rascunho)
CREATE OR REPLACE FUNCTION public.calcular_comissoes_usuario_simulacao(_sim_id uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  s RECORD; r RECORD; b RECORD;
  v_base numeric; v_valor numeric; v_com_id uuid; v_pay_id uuid; v_nome text; v_ids uuid[];
  v_banco text; v_hoje date := CURRENT_DATE; v_criados int := 0;
BEGIN
  SELECT * INTO s FROM public.simulacoes WHERE id = _sim_id;
  IF NOT FOUND OR s.deleted_at IS NOT NULL THEN RETURN 0; END IF;

  v_ids := ARRAY_REMOVE(ARRAY[s.usuario_criador_id, s.usuario_responsavel_id, s.analista_id, s.comercial_id, s.parceiro_id], NULL);
  IF array_length(v_ids, 1) IS NULL THEN RETURN 0; END IF;

  SELECT nome_banco INTO v_banco FROM public.propostas WHERE simulacao_id = _sim_id AND deleted_at IS NULL LIMIT 1;
  v_base := COALESCE(NULLIF(s.valor_financiamento, 0), s.valor_imovel, 0);
  IF v_base <= 0 THEN RETURN 0; END IF;

  FOR r IN
    SELECT * FROM public.comissao_regras_usuario cr
    WHERE cr.correspondente_id = s.correspondente_id
      AND cr.ativo = true
      AND cr.gatilho = 'rascunho'
      AND cr.usuario_id = ANY(v_ids)
      AND (cr.banco_nome IS NULL OR cr.banco_nome = v_banco)
      AND (cr.produto IS NULL OR cr.produto = s.produto)
      AND (cr.vigencia_inicio IS NULL OR cr.vigencia_inicio <= v_hoje)
      AND (cr.vigencia_fim IS NULL OR cr.vigencia_fim >= v_hoje)
  LOOP
    IF EXISTS (SELECT 1 FROM public.comissoes_usuario WHERE simulacao_id = _sim_id AND usuario_id = r.usuario_id AND regra_id = r.id) THEN
      CONTINUE;
    END IF;

    v_valor := round(v_base * r.percentual / 100.0, 2);
    SELECT nome INTO v_nome FROM public.profiles WHERE id = r.usuario_id;

    INSERT INTO public.financial_payables (correspondente_id, descricao, parceiro_id, vencimento, valor, status, criador_id)
    VALUES (s.correspondente_id, 'Comissão simulação ' || COALESCE(s.numero_simulacao,'') || ' — ' || COALESCE(v_nome,''),
            r.usuario_id, v_hoje + 35, v_valor, 'aberta', s.usuario_responsavel_id)
    RETURNING id INTO v_pay_id;

    INSERT INTO public.comissoes_usuario (
      correspondente_id, simulacao_id, usuario_id, regra_id, tipo_vinculo, gatilho, base_calculo,
      percentual, valor_base, valor_comissao, banco_nome, produto, numero_proposta, status, payable_id
    ) VALUES (
      s.correspondente_id, _sim_id, r.usuario_id, r.id, r.tipo_vinculo, 'rascunho', r.base_calculo,
      r.percentual, v_base, v_valor, v_banco, s.produto, s.numero_simulacao, 'a_pagar', v_pay_id
    ) RETURNING id INTO v_com_id;

    INSERT INTO public.financial_audit_logs (correspondente_id, entidade, entidade_id, acao, dados)
    VALUES (s.correspondente_id, 'comissao_usuario', v_com_id, 'calculada',
            jsonb_build_object('usuario_id', r.usuario_id, 'valor', v_valor, 'gatilho', 'rascunho', 'origem', 'simulacao'));

    v_criados := v_criados + 1;
  END LOOP;
  RETURN v_criados;
END;
$function$;

-- 5) recálculo geral: simulações + propostas (todas as etapas já atingidas)
CREATE OR REPLACE FUNCTION public.recalcular_comissoes_usuario_correspondente(_corr uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p RECORD; s RECORD; total int := 0;
BEGIN
  IF NOT public.usuario_pode_financeiro(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _corr IS DISTINCT FROM public.correspondente_do_usuario(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  FOR s IN SELECT id FROM public.simulacoes WHERE correspondente_id = _corr AND deleted_at IS NULL LOOP
    total := total + public.calcular_comissoes_usuario_simulacao(s.id);
  END LOOP;

  FOR p IN SELECT id, status FROM public.propostas WHERE correspondente_id = _corr AND deleted_at IS NULL LOOP
    total := total + public.calcular_comissoes_usuario_proposta(p.id, p.status::text);
  END LOOP;

  RETURN total;
END;
$function$;

-- 6) trigger: nova simulação gera comissão do gatilho "Simulação"
CREATE OR REPLACE FUNCTION public.trg_simulacao_comissoes_usuario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  PERFORM public.calcular_comissoes_usuario_simulacao(NEW.id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_simulacao_comissoes_usuario ON public.simulacoes;
CREATE TRIGGER on_simulacao_comissoes_usuario
AFTER INSERT ON public.simulacoes
FOR EACH ROW EXECUTE FUNCTION public.trg_simulacao_comissoes_usuario();