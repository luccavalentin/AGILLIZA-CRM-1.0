ALTER TABLE public.comissao_regras_usuario ALTER COLUMN gatilho TYPE text USING gatilho::text;
ALTER TABLE public.comissoes_usuario ALTER COLUMN gatilho TYPE text USING gatilho::text;

CREATE OR REPLACE FUNCTION public.calcular_comissoes_usuario_proposta(_prop_id uuid, _gatilho text DEFAULT 'contrato_emitido')
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD;
  r RECORD;
  v_repasse numeric;
  v_valor_contrato numeric;
  v_base numeric;
  v_valor numeric;
  v_com_id uuid;
  v_pay_id uuid;
  v_nome text;
  v_hoje date := CURRENT_DATE;
  v_criados int := 0;
BEGIN
  SELECT * INTO p FROM public.propostas WHERE id = _prop_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  v_valor_contrato := COALESCE(p.valor_financiamento, 0);
  SELECT COALESCE(valor_bruto, 0) INTO v_repasse FROM public.comissoes WHERE proposta_id = _prop_id LIMIT 1;
  IF v_repasse IS NULL THEN v_repasse := 0; END IF;

  FOR r IN
    SELECT * FROM public.comissao_regras_usuario cr
    WHERE cr.correspondente_id = p.correspondente_id
      AND cr.ativo = true
      AND cr.gatilho = _gatilho
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
      v_base := v_repasse;
    END IF;
    v_valor := round(v_base * r.percentual / 100.0, 2);

    SELECT nome INTO v_nome FROM public.profiles WHERE id = r.usuario_id;

    INSERT INTO public.financial_payables (
      correspondente_id, descricao, parceiro_id, vencimento, valor, status, criador_id
    ) VALUES (
      p.correspondente_id,
      'Comissão ' || COALESCE(p.numero_proposta,'') || ' — ' || COALESCE(v_nome,''),
      r.usuario_id,
      v_hoje + 35,
      v_valor,
      'aberta',
      p.usuario_responsavel_id
    ) RETURNING id INTO v_pay_id;

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

CREATE OR REPLACE FUNCTION public.on_proposta_contrato_emitido()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'contrato_emitido'
     AND (
       OLD.status IS DISTINCT FROM NEW.status
       OR NOT EXISTS (SELECT 1 FROM public.comissoes c WHERE c.proposta_id = NEW.id)
     ) THEN
    PERFORM public.calcular_comissao_proposta(NEW.id);
  END IF;

  -- comissões de usuário: qualquer etapa configurada como gatilho
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.calcular_comissoes_usuario_proposta(NEW.id, NEW.status::text);
  ELSIF NEW.status = 'contrato_emitido' THEN
    PERFORM public.calcular_comissoes_usuario_proposta(NEW.id, 'contrato_emitido');
  END IF;

  RETURN NEW;
END;
$function$;