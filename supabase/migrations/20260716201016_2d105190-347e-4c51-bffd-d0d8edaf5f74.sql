
-- Enums
DO $$ BEGIN
  CREATE TYPE public.comissao_tipo_vinculo AS ENUM ('corretor','imobiliaria','parceiro','comercial_agilliza','analista','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.comissao_gatilho AS ENUM ('contrato_emitido','credito_aprovado','assinatura_contrato','registro_imovel','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.comissao_base_calculo AS ENUM ('valor_contrato','percentual_repasse');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.comissao_usuario_status AS ENUM ('a_pagar','paga','cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela de regras
CREATE TABLE IF NOT EXISTS public.comissao_regras_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  usuario_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo_vinculo public.comissao_tipo_vinculo NOT NULL DEFAULT 'outro',
  gatilho public.comissao_gatilho NOT NULL DEFAULT 'contrato_emitido',
  base_calculo public.comissao_base_calculo NOT NULL DEFAULT 'valor_contrato',
  percentual numeric NOT NULL CHECK (percentual >= 0 AND percentual <= 100),
  banco_nome text,
  produto text,
  vigencia_inicio date,
  vigencia_fim date,
  ativo boolean NOT NULL DEFAULT true,
  observacao text,
  criador_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comissao_regras_usuario TO authenticated;
GRANT ALL ON public.comissao_regras_usuario TO service_role;

ALTER TABLE public.comissao_regras_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "com_regras_usuario_select" ON public.comissao_regras_usuario
  FOR SELECT USING (
    correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND public.usuario_pode_financeiro(auth.uid())
  );
CREATE POLICY "com_regras_usuario_insert" ON public.comissao_regras_usuario
  FOR INSERT WITH CHECK (
    correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND public.usuario_pode_financeiro(auth.uid())
  );
CREATE POLICY "com_regras_usuario_update" ON public.comissao_regras_usuario
  FOR UPDATE USING (
    correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND public.usuario_pode_financeiro(auth.uid())
  );
CREATE POLICY "com_regras_usuario_delete" ON public.comissao_regras_usuario
  FOR DELETE USING (
    correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND public.usuario_pode_financeiro(auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_com_regras_usuario_corr ON public.comissao_regras_usuario(correspondente_id, ativo);
CREATE INDEX IF NOT EXISTS idx_com_regras_usuario_user ON public.comissao_regras_usuario(usuario_id);

CREATE TRIGGER trg_com_regras_usuario_upd
  BEFORE UPDATE ON public.comissao_regras_usuario
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de lançamentos
CREATE TABLE IF NOT EXISTS public.comissoes_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  proposta_id uuid NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  regra_id uuid REFERENCES public.comissao_regras_usuario(id) ON DELETE SET NULL,
  tipo_vinculo public.comissao_tipo_vinculo NOT NULL DEFAULT 'outro',
  gatilho public.comissao_gatilho NOT NULL DEFAULT 'contrato_emitido',
  base_calculo public.comissao_base_calculo NOT NULL DEFAULT 'valor_contrato',
  percentual numeric NOT NULL DEFAULT 0,
  valor_base numeric NOT NULL DEFAULT 0,
  valor_comissao numeric NOT NULL DEFAULT 0,
  banco_nome text,
  produto text,
  numero_proposta text,
  status public.comissao_usuario_status NOT NULL DEFAULT 'a_pagar',
  payable_id uuid REFERENCES public.financial_payables(id) ON DELETE SET NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposta_id, usuario_id, regra_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comissoes_usuario TO authenticated;
GRANT ALL ON public.comissoes_usuario TO service_role;

ALTER TABLE public.comissoes_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "com_usuario_select" ON public.comissoes_usuario
  FOR SELECT USING (
    correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (
      public.usuario_pode_financeiro(auth.uid())
      OR usuario_id = auth.uid()
    )
  );
CREATE POLICY "com_usuario_insert" ON public.comissoes_usuario
  FOR INSERT WITH CHECK (
    correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND public.usuario_pode_financeiro(auth.uid())
  );
CREATE POLICY "com_usuario_update" ON public.comissoes_usuario
  FOR UPDATE USING (
    correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND public.usuario_pode_financeiro(auth.uid())
  );
CREATE POLICY "com_usuario_delete" ON public.comissoes_usuario
  FOR DELETE USING (
    correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND public.usuario_pode_financeiro(auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_com_usuario_corr ON public.comissoes_usuario(correspondente_id, status);
CREATE INDEX IF NOT EXISTS idx_com_usuario_prop ON public.comissoes_usuario(proposta_id);
CREATE INDEX IF NOT EXISTS idx_com_usuario_user ON public.comissoes_usuario(usuario_id);

CREATE TRIGGER trg_com_usuario_upd
  BEFORE UPDATE ON public.comissoes_usuario
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função de cálculo
CREATE OR REPLACE FUNCTION public.calcular_comissoes_usuario_proposta(_prop_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      AND cr.gatilho = 'contrato_emitido'
      AND (cr.banco_nome IS NULL OR cr.banco_nome = p.nome_banco)
      AND (cr.produto IS NULL OR cr.produto = p.produto)
      AND (cr.vigencia_inicio IS NULL OR cr.vigencia_inicio <= v_hoje)
      AND (cr.vigencia_fim IS NULL OR cr.vigencia_fim >= v_hoje)
  LOOP
    -- evita duplicidade
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

    -- gera conta a pagar
    INSERT INTO public.financial_payables (
      correspondente_id, descricao, parceiro_id, vencimento, valor, status, criador_id
    ) VALUES (
      p.correspondente_id,
      'Comissão contrato ' || COALESCE(p.numero_proposta,'') || ' — ' || COALESCE(v_nome,''),
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
            jsonb_build_object('usuario_id', r.usuario_id, 'valor', v_valor, 'base', r.base_calculo, 'percentual', r.percentual));

    v_criados := v_criados + 1;
  END LOOP;

  RETURN v_criados;
END;
$$;

-- Atualiza o trigger existente para chamar também o cálculo por usuário
CREATE OR REPLACE FUNCTION public.on_proposta_contrato_emitido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'contrato_emitido'
     AND (
       OLD.status IS DISTINCT FROM NEW.status
       OR NOT EXISTS (SELECT 1 FROM public.comissoes c WHERE c.proposta_id = NEW.id)
     ) THEN
    PERFORM public.calcular_comissao_proposta(NEW.id);
    PERFORM public.calcular_comissoes_usuario_proposta(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
